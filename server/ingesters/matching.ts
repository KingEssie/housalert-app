import { createClient } from "@supabase/supabase-js";
import { log } from "../log";
import { trackListingSeen } from "../freshness";
import { matchListingAgainstProfiles } from "../matching/engine";
import { resolveCoordinates, type GeocodableFields } from "./geocoding";

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
  furnished?: boolean | null;
  pets_allowed?: boolean | null;
  balcony?: boolean | null;
  elevator?: boolean | null;
  garden?: boolean | null;
  bath?: boolean | null;
  roof_terrace?: boolean | null;
  parking?: boolean | null;
  energy_label?: string | null;
  property_type?: string | null;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  extra_features?: string[] | null;
  target_categories?: string[] | null;
  postcode?: string | null;
  street?: string | null;
  coordinate_source?: string | null;
  coordinate_precision?: string | null;
  listing_cluster_id?: string | null;
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
let hasAdvancedColumns: boolean | null = null;

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

let hasFurnishedColumn: boolean | null = null;

async function checkFurnishedColumn(): Promise<boolean> {
  if (hasFurnishedColumn !== null) return hasFurnishedColumn;
  const { error } = await supabase.from("listings").select("furnished").limit(1);
  hasFurnishedColumn = !error;
  if (!hasFurnishedColumn) {
    log("furnished column not found — run migration 016_listings_furnished.sql in Supabase SQL Editor");
  }
  return hasFurnishedColumn;
}

let hasDistrictColumn: boolean | null = null;

async function checkDistrictColumn(): Promise<boolean> {
  if (hasDistrictColumn !== null) return hasDistrictColumn;
  const { error } = await supabase.from("listings").select("district").limit(1);
  hasDistrictColumn = !error;
  if (!hasDistrictColumn) {
    log("district column not found — run migration 017_listings_district.sql in Supabase SQL Editor");
  }
  return hasDistrictColumn;
}

async function checkAdvancedColumns(): Promise<boolean> {
  if (hasAdvancedColumns !== null) return hasAdvancedColumns;
  const { error } = await supabase.from("listings").select("pets_allowed, balcony, elevator").limit(1);
  hasAdvancedColumns = !error;
  if (!hasAdvancedColumns) {
    log("Advanced columns (pets_allowed, balcony, etc.) not found — run migration 015 in Supabase SQL Editor");
  }
  return hasAdvancedColumns;
}

let hasCoordMetadataColumns: boolean | null = null;

async function checkCoordMetadataColumns(): Promise<boolean> {
  if (hasCoordMetadataColumns !== null) return hasCoordMetadataColumns;
  const { error } = await supabase.from("listings").select("coordinate_source, coordinate_precision").limit(1);
  hasCoordMetadataColumns = !error;
  if (!hasCoordMetadataColumns) {
    log("Coordinate metadata columns not found — run migration 026 in Supabase SQL Editor. Coordinates will still be resolved but metadata won't be stored.");
  }
  return hasCoordMetadataColumns;
}

let hasClusterIdColumn: boolean | null = null;

async function checkClusterIdColumn(): Promise<boolean> {
  if (hasClusterIdColumn !== null) return hasClusterIdColumn;
  const { error } = await supabase.from("listings").select("listing_cluster_id").limit(1);
  hasClusterIdColumn = !error;
  if (!hasClusterIdColumn) {
    log("listing_cluster_id column not found — run migration 030_cross_source_dedup.sql in Supabase SQL Editor to enable cross-source deduplication.");
  }
  return hasClusterIdColumn;
}

async function assignCrossSourceCluster(insertedId: string, listing: ParsedListing): Promise<void> {
  try {
    if (!listing.price || !listing.city) return;
    const priceLow  = Math.round(listing.price * 0.92);
    const priceHigh = Math.round(listing.price * 1.08);

    let query = supabase
      .from("listings")
      .select("id, listing_cluster_id")
      .eq("city", listing.city)
      .neq("source", listing.source)
      .neq("id", insertedId)
      .gte("price", priceLow)
      .lte("price", priceHigh)
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(3);

    if (listing.bedrooms && listing.bedrooms > 0) {
      query = (query as any).eq("bedrooms", listing.bedrooms);
    }
    if (listing.size_m2 && listing.size_m2 > 0) {
      const sizeLow  = Math.round(listing.size_m2 * 0.85);
      const sizeHigh = Math.round(listing.size_m2 * 1.15);
      query = (query as any).gte("size_m2", sizeLow).lte("size_m2", sizeHigh);
    }

    const { data: candidates } = await query;
    let clusterId: string | null = null;

    if (candidates && candidates.length > 0) {
      const withCluster = candidates.find((r: any) => r.listing_cluster_id);
      clusterId = withCluster?.listing_cluster_id ?? crypto.randomUUID();
      if (!withCluster) {
        await supabase.from("listings").update({ listing_cluster_id: clusterId }).eq("id", candidates[0].id);
      }
      log(`[CLUSTER] Linked ${insertedId} ↔ ${candidates[0].id} via cluster ${clusterId} (cross-source: ${listing.source} ↔ ${candidates[0].listing_cluster_id ? "existing" : "new"})`);
    } else {
      clusterId = crypto.randomUUID();
    }

    await supabase.from("listings").update({ listing_cluster_id: clusterId }).eq("id", insertedId);
  } catch (err: any) {
    log(`[CLUSTER] assignCrossSourceCluster error: ${err.message}`);
  }
}

const ADVANCED_FIELDS: (keyof ParsedListing)[] = [
  "pets_allowed", "balcony", "elevator",
  "garden", "bath", "roof_terrace", "parking", "energy_label", "property_type",
  "latitude", "longitude", "extra_features", "target_categories",
];

const COORD_METADATA_FIELDS: (keyof ParsedListing)[] = [
  "coordinate_source", "coordinate_precision",
];

export async function insertAndMatchListings(
  parsed: ParsedListing[]
): Promise<{ inserted: number; duplicates: number; matches: number; errors: number }> {
  const useSourceId   = await checkSourceIdColumn();
  const useImageUrl   = await checkImageUrlColumn();
  const useFurnished  = await checkFurnishedColumn();
  const useDistrict   = await checkDistrictColumn();
  const useAdvanced   = await checkAdvancedColumns();
  const useCoordMeta  = await checkCoordMetadataColumns();
  const useClusterId  = await checkClusterIdColumn();

  let inserted = 0;
  let duplicates = 0;
  let totalMatches = 0;
  let errors = 0;

  const existingBySourceId = new Map<string, string>();
  const existingByUrl = new Map<string, string>();

  if (parsed.length > 0 && useSourceId) {
    const sourceIds = parsed.map(l => l.source_id).filter(Boolean);
    const sources = [...new Set(parsed.map(l => l.source))];
    if (sourceIds.length > 0) {
      for (const src of sources) {
        const batch = parsed.filter(l => l.source === src).map(l => l.source_id);
        const BATCH_SIZE = 50;
        for (let i = 0; i < batch.length; i += BATCH_SIZE) {
          const chunk = batch.slice(i, i + BATCH_SIZE);
          const { data } = await supabase
            .from("listings")
            .select("id, source_id")
            .eq("source", src)
            .in("source_id", chunk);
          if (data) {
            for (const row of data) {
              existingBySourceId.set(`${src}:${row.source_id}`, row.id);
            }
          }
        }
      }
    }
  }

  if (parsed.length > 0) {
    const urls = parsed.map(l => l.url).filter(Boolean);
    const BATCH_SIZE = 50;
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      const chunk = urls.slice(i, i + BATCH_SIZE);
      const { data } = await supabase
        .from("listings")
        .select("id, url")
        .in("url", chunk);
      if (data) {
        for (const row of data) {
          existingByUrl.set(row.url, row.id);
        }
      }
    }
  }

  let coordsResolved = 0;
  let coordsFailed = 0;
  const coordStats: Record<string, number> = { direct: 0, geocoded: 0, city_fallback: 0 };

  for (const listing of parsed) {
    if (useAdvanced && (listing.latitude == null || listing.longitude == null || listing.latitude === 0 || listing.longitude === 0)) {
      try {
        const geoFields: GeocodableFields = {
          latitude: listing.latitude,
          longitude: listing.longitude,
          city: listing.city,
          postcode: listing.postcode,
          street: listing.street,
          district: listing.district,
        };
        const resolved = await resolveCoordinates(geoFields);
        if (resolved) {
          listing.latitude = resolved.latitude;
          listing.longitude = resolved.longitude;
          listing.coordinate_source = resolved.coordinate_source;
          listing.coordinate_precision = resolved.coordinate_precision;
          coordsResolved++;
          coordStats[resolved.coordinate_source] = (coordStats[resolved.coordinate_source] || 0) + 1;
        } else {
          coordsFailed++;
        }
      } catch (err: any) {
        log(`[GEOCODE] Error resolving coords for "${listing.title}": ${err.message}`);
        coordsFailed++;
      }
    } else if (listing.latitude != null && listing.longitude != null) {
      if (!listing.coordinate_source) listing.coordinate_source = "direct";
      if (!listing.coordinate_precision) listing.coordinate_precision = "exact";
      coordStats.direct = (coordStats.direct || 0) + 1;
    }

    let isDuplicate = false;
    let duplicateId: string | null = null;

    if (useSourceId) {
      const key = `${listing.source}:${listing.source_id}`;
      const cachedId = existingBySourceId.get(key);
      if (cachedId) {
        isDuplicate = true;
        duplicateId = cachedId;
      }
    }

    if (!isDuplicate) {
      const cachedId = existingByUrl.get(listing.url);
      if (cachedId) {
        isDuplicate = true;
        duplicateId = cachedId;
      }
    }

    if (isDuplicate) {
      if (duplicateId) {
        trackListingSeen(duplicateId, listing.source, listing.source_id).catch(() => {});
        const updateData: Record<string, any> = {};
        if (useImageUrl && listing.image_url) {
          updateData.image_url = listing.image_url;
        }
        if (useFurnished && listing.furnished != null) {
          updateData.furnished = listing.furnished;
        }
        if (useDistrict && listing.district != null) {
          updateData.district = listing.district;
        }
        if (useAdvanced) {
          for (const field of ADVANCED_FIELDS) {
            if (listing[field] != null) {
              updateData[field] = listing[field];
            }
          }
        }
        if (useCoordMeta) {
          for (const field of COORD_METADATA_FIELDS) {
            if (listing[field] != null) {
              updateData[field] = listing[field];
            }
          }
        }
        if (Object.keys(updateData).length > 0) {
          supabase.from("listings").update(updateData).eq("id", duplicateId).then(() => {}).catch(() => {});
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

    if (useFurnished && listing.furnished != null) {
      insertData.furnished = listing.furnished;
    }

    if (useDistrict && listing.district != null) {
      insertData.district = listing.district;
    }

    if (useAdvanced) {
      for (const field of ADVANCED_FIELDS) {
        if (listing[field] != null) {
          insertData[field] = listing[field];
        }
      }
    }

    if (useCoordMeta) {
      for (const field of COORD_METADATA_FIELDS) {
        if (listing[field] != null) {
          insertData[field] = listing[field];
        }
      }
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
        const cause = (insertErr as any)?.cause?.message ?? (insertErr as any)?.cause?.code ?? "";
        const causeStr = cause ? ` (cause: ${cause})` : "";
        log(`Insert error for ${listing.source_id}: ${insertErr.message}${causeStr}`);
        errors++;
      }
      continue;
    }

    inserted++;

    if (row) {
      trackListingSeen(row.id, listing.source, listing.source_id).catch(() => {});
      if (useClusterId) {
        assignCrossSourceCluster(row.id, listing).catch(() => {});
      }
      const matchStart = Date.now();
      const matchCount = await runMatchingForListing(row as DbListing);
      if (matchCount > 0) {
        const matchDuration = Date.now() - matchStart;
        log(`[LATENCY] insert→match for ${row.id}: ${matchDuration}ms (${matchCount} matches)`);
      }
      totalMatches += matchCount;
    }
  }

  if (coordsResolved > 0 || coordsFailed > 0) {
    log(`[GEOCODE] Coordinate resolution: resolved=${coordsResolved} (direct=${coordStats.direct}, geocoded=${coordStats.geocoded}, city_fallback=${coordStats.city_fallback}), failed=${coordsFailed}`);
  }

  return { inserted, duplicates, matches: totalMatches, errors };
}
