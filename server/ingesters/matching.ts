import { createClient } from "@supabase/supabase-js";
import { log } from "../log";
import { trackListingSeen } from "../freshness";
import { matchListingAgainstProfiles } from "../matching/engine";

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for ingestion");
}

export const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export interface ParsedListing {
  title: string;
  url: string;
  city: string;
  price: number;
  bedrooms: number;
  size_m2: number;
  source: string;
  source_id: string;
  image_url?: string | null;
}

interface DbListing {
  id: string;
  source: string;
  url: string | null;
  title: string;
  city: string;
  price: number;
  bedrooms: number;
  size_m2: number;
}

export async function runMatchingForListing(listing: DbListing): Promise<number> {
  return matchListingAgainstProfiles(listing.id);
}

let hasSourceIdColumn: boolean | null = null;
let hasImageUrlColumn: boolean | null = null;

async function checkSourceIdColumn(): Promise<boolean> {
  if (hasSourceIdColumn !== null) return hasSourceIdColumn;
  const { error } = await supabase.from("listings").select("source_id").limit(1);
  hasSourceIdColumn = !error;
  if (!hasSourceIdColumn) {
    log("source_id column not found on listings table — using URL-based dedup only");
  }
  return hasSourceIdColumn;
}

async function checkImageUrlColumn(): Promise<boolean> {
  if (hasImageUrlColumn !== null) return hasImageUrlColumn;
  const { error } = await supabase.from("listings").select("image_url").limit(1);
  hasImageUrlColumn = !error;
  if (!hasImageUrlColumn) {
    log("image_url column not found on listings table — run migration 005_image_url.sql in Supabase SQL Editor");
  }
  return hasImageUrlColumn;
}

export async function insertAndMatchListings(
  parsed: ParsedListing[]
): Promise<{ inserted: number; duplicates: number; matches: number; errors: number }> {
  const useSourceId = await checkSourceIdColumn();
  const useImageUrl = await checkImageUrlColumn();

  let inserted = 0;
  let duplicates = 0;
  let totalMatches = 0;
  let errors = 0;

  for (const listing of parsed) {
    let isDuplicate = false;
    let duplicateId: string | null = null;

    if (useSourceId) {
      const { data: existingRows } = await supabase
        .from("listings")
        .select("id")
        .eq("source", listing.source)
        .eq("source_id", listing.source_id)
        .limit(1);
      if (existingRows && existingRows.length > 0) {
        isDuplicate = true;
        duplicateId = existingRows[0].id;
      }
    }

    if (!isDuplicate) {
      const { data: existingByUrl } = await supabase
        .from("listings")
        .select("id")
        .eq("url", listing.url)
        .limit(1);
      if (existingByUrl && existingByUrl.length > 0) {
        isDuplicate = true;
        duplicateId = existingByUrl[0].id;
      }
    }

    if (isDuplicate) {
      if (duplicateId) {
        trackListingSeen(duplicateId, listing.source, listing.source_id).catch(() => {});
        if (useImageUrl && listing.image_url) {
          supabase.from("listings").update({ image_url: listing.image_url }).eq("id", duplicateId).then(() => {}).catch(() => {});
        }
      }
      duplicates++;
      continue;
    }

    const insertData: Record<string, any> = {
      source: listing.source,
      url: listing.url,
      title: listing.title,
      city: listing.city,
      price: listing.price,
      bedrooms: listing.bedrooms,
      size_m2: listing.size_m2,
    };

    if (useImageUrl && listing.image_url) {
      insertData.image_url = listing.image_url;
    }

    if (useSourceId) {
      insertData.source_id = listing.source_id;
    }

    const { data: row, error: insertErr } = await supabase
      .from("listings")
      .insert(insertData)
      .select()
      .single();

    if (insertErr) {
      if (insertErr.code === "23505") {
        duplicates++;
        if (useSourceId) {
          const { data: dupRow } = await supabase
            .from("listings")
            .select("id")
            .eq("source", listing.source)
            .eq("source_id", listing.source_id)
            .limit(1)
            .maybeSingle();
          if (dupRow) {
            trackListingSeen(dupRow.id, listing.source, listing.source_id).catch(() => {});
          }
        }
      } else {
        log(`Insert error for ${listing.source_id}: ${insertErr.message}`);
        errors++;
      }
      continue;
    }

    inserted++;

    if (row) {
      trackListingSeen(row.id, listing.source, listing.source_id).catch(() => {});
      const matchCount = await runMatchingForListing(row as DbListing);
      totalMatches += matchCount;
    }
  }

  return { inserted, duplicates, matches: totalMatches, errors };
}
