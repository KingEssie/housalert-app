import { createClient } from "@supabase/supabase-js";
import { log } from "../index";
import { sendMatchAlert } from "../email";

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
}

interface SearchProfile {
  id: string;
  user_id: string;
  city: string;
  price_min: number;
  price_max: number;
  bedrooms_min: number;
  size_min: number;
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

function doesListingMatchProfile(listing: DbListing, profile: SearchProfile): boolean {
  const listingCity = listing.city.toLowerCase().trim();
  const profileCity = profile.city.toLowerCase().trim();
  if (!listingCity.includes(profileCity) && !profileCity.includes(listingCity)) {
    return false;
  }
  if (profile.price_min > 0 && listing.price < profile.price_min) return false;
  if (profile.price_max > 0 && listing.price > profile.price_max) return false;
  if (profile.bedrooms_min > 0 && listing.bedrooms < profile.bedrooms_min) return false;
  if (profile.size_min > 0 && listing.size_m2 < profile.size_min) return false;
  return true;
}

export async function runMatchingForListing(listing: DbListing): Promise<number> {
  const { data: profiles, error: pErr } = await supabase
    .from("search_profiles")
    .select("*");

  if (pErr || !profiles || profiles.length === 0) return 0;

  let totalMatches = 0;
  const alertedUsers = new Set<string>();

  for (const profile of profiles as SearchProfile[]) {
    if (!doesListingMatchProfile(listing, profile)) continue;

    const { data: existing } = await supabase
      .from("matches")
      .select("id")
      .eq("user_id", profile.user_id)
      .eq("search_profile_id", profile.id)
      .eq("listing_id", listing.id)
      .maybeSingle();

    if (existing) continue;

    const { error: mErr } = await supabase.from("matches").insert({
      user_id: profile.user_id,
      search_profile_id: profile.id,
      listing_id: listing.id,
    });

    if (!mErr) {
      totalMatches++;

      if (!alertedUsers.has(profile.user_id)) {
        alertedUsers.add(profile.user_id);

        const { data: userData } = await supabase.auth.admin.getUserById(profile.user_id);
        const email = userData?.user?.email;
        if (email) {
          sendMatchAlert(email, listing).catch(() => {});
        }
      }
    }
  }

  return totalMatches;
}

let hasSourceIdColumn: boolean | null = null;

async function checkSourceIdColumn(): Promise<boolean> {
  if (hasSourceIdColumn !== null) return hasSourceIdColumn;
  const { error } = await supabase.from("listings").select("source_id").limit(1);
  hasSourceIdColumn = !error;
  if (!hasSourceIdColumn) {
    log("source_id column not found on listings table — using URL-based dedup only");
  }
  return hasSourceIdColumn;
}

export async function insertAndMatchListings(
  parsed: ParsedListing[]
): Promise<{ inserted: number; duplicates: number; matches: number; errors: number }> {
  const useSourceId = await checkSourceIdColumn();

  let inserted = 0;
  let duplicates = 0;
  let totalMatches = 0;
  let errors = 0;

  for (const listing of parsed) {
    let isDuplicate = false;

    if (useSourceId) {
      const { data: existingRows } = await supabase
        .from("listings")
        .select("id")
        .eq("source", listing.source)
        .eq("source_id", listing.source_id)
        .limit(1);
      isDuplicate = !!(existingRows && existingRows.length > 0);
    }

    if (!isDuplicate) {
      const { data: existingByUrl } = await supabase
        .from("listings")
        .select("id")
        .eq("url", listing.url)
        .limit(1);
      isDuplicate = !!(existingByUrl && existingByUrl.length > 0);
    }

    if (isDuplicate) {
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
      } else {
        log(`Insert error for ${listing.source_id}: ${insertErr.message}`);
        errors++;
      }
      continue;
    }

    inserted++;

    if (row) {
      const matchCount = await runMatchingForListing(row as DbListing);
      totalMatches += matchCount;
    }
  }

  return { inserted, duplicates, matches: totalMatches, errors };
}
