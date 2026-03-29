import { createClient } from "@supabase/supabase-js";
import {
  resolveCoordinates,
  extractPostcodeFromText,
  extractStreetFromAddress,
  type CoordinatePrecision,
  type GeocodableFields,
} from "../ingesters/geocoding";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const PRECISION_RANK: Record<string, number> = {
  exact: 3,
  approximate: 2,
  city_level: 1,
};

interface BackfillOptions {
  limit: number;
  batchSize: number;
  source: string | null;
  dryRun: boolean;
  recentOnly: boolean;
  pauseBetweenBatchesMs: number;
}

interface BackfillStats {
  candidates: number;
  processed: number;
  directCoords: number;
  geocoded: number;
  cityFallback: number;
  unresolved: number;
  skippedAlreadyGood: number;
  upgraded: number;
  errors: number;
}

function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2);
  const opts: BackfillOptions = {
    limit: 500,
    batchSize: 50,
    source: null,
    dryRun: false,
    recentOnly: false,
    pauseBetweenBatchesMs: 2000,
  };

  for (const arg of args) {
    if (arg.startsWith("--limit=")) opts.limit = parseInt(arg.split("=")[1], 10);
    else if (arg.startsWith("--batch=")) opts.batchSize = parseInt(arg.split("=")[1], 10);
    else if (arg.startsWith("--source=")) opts.source = arg.split("=")[1];
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--recent-only") opts.recentOnly = true;
    else if (arg.startsWith("--pause=")) opts.pauseBetweenBatchesMs = parseInt(arg.split("=")[1], 10);
    else console.log(`Unknown argument: ${arg}`);
  }

  return opts;
}

async function checkRequiredColumns(): Promise<{ hasLatLng: boolean; hasCoordMeta: boolean; hasGeocodeCache: boolean }> {
  const { error: e1 } = await supabase.from("listings").select("latitude, longitude").limit(1);
  const { error: e2 } = await supabase.from("listings").select("coordinate_source, coordinate_precision").limit(1);
  const { error: e3 } = await supabase.from("geocode_cache").select("cache_key").limit(1);
  return {
    hasLatLng: !e1,
    hasCoordMeta: !e2,
    hasGeocodeCache: !e3,
  };
}

function buildGeocodableFields(listing: any): GeocodableFields {
  const fields: GeocodableFields = {
    city: listing.city,
    latitude: listing.latitude ?? null,
    longitude: listing.longitude ?? null,
    district: listing.district ?? null,
  };

  if (listing.title) {
    const postcode = extractPostcodeFromText(listing.title);
    if (postcode) fields.postcode = postcode;
  }

  if (listing.source === "wg-gesucht" && listing.url) {
    try {
      const parts = new URL(listing.url).pathname.split("/");
      const cityPart = parts.find((p: string) => p.includes("."));
      if (cityPart) {
        const postcodeFromUrl = extractPostcodeFromText(listing.title || "");
        if (postcodeFromUrl && !fields.postcode) fields.postcode = postcodeFromUrl;
      }
    } catch {}
  }

  return fields;
}

function shouldSkip(listing: any): boolean {
  if (listing.coordinate_precision) {
    const currentRank = PRECISION_RANK[listing.coordinate_precision] ?? 0;
    if (currentRank >= 3) return true;
  }

  if (listing.latitude != null && listing.longitude != null &&
      listing.latitude !== 0 && listing.longitude !== 0) {
    if (!listing.coordinate_source) return false;
    if (listing.coordinate_source === "direct") return true;
  }

  return false;
}

function isUpgrade(currentPrecision: string | null, newPrecision: CoordinatePrecision): boolean {
  const currentRank = PRECISION_RANK[currentPrecision ?? ""] ?? 0;
  const newRank = PRECISION_RANK[newPrecision] ?? 0;
  return newRank > currentRank;
}

const SOURCE_PRIORITY_ORDER = ["wg-gesucht", "immowelt", "kleinanzeigen", "wohnungsboerse", "nestpick", "rentola"];

async function fetchBatch(
  opts: BackfillOptions,
  offset: number,
  columns: { hasCoordMeta: boolean }
): Promise<any[]> {
  const selectCols = "id, source, url, title, city, district, latitude, longitude" +
    (columns.hasCoordMeta ? ", coordinate_source, coordinate_precision" : "");

  let query = supabase
    .from("listings")
    .select(selectCols)
    .is("latitude", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + opts.batchSize - 1);

  if (opts.source) {
    query = query.eq("source", opts.source);
  }

  if (opts.recentOnly) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("created_at", sevenDaysAgo);
  }

  const { data, error } = await query;
  if (error) {
    console.error(`[BACKFILL] Fetch error at offset=${offset}: ${error.message}`);
    return [];
  }
  return data ?? [];
}

async function countCandidates(opts: BackfillOptions): Promise<number> {
  let query = supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .is("latitude", null);

  if (opts.source) {
    query = query.eq("source", opts.source);
  }

  if (opts.recentOnly) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("created_at", sevenDaysAgo);
  }

  const { count, error } = await query;
  if (error) {
    console.error(`[BACKFILL] Count error: ${error.message}`);
    return 0;
  }
  return count ?? 0;
}

async function run() {
  const opts = parseArgs();

  console.log("=== COORDINATE BACKFILL ===");
  console.log(`Mode: ${opts.dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Limit: ${opts.limit}`);
  console.log(`Batch size: ${opts.batchSize}`);
  console.log(`Source filter: ${opts.source ?? "all"}`);
  console.log(`Recent only: ${opts.recentOnly}`);
  console.log(`Pause between batches: ${opts.pauseBetweenBatchesMs}ms`);
  console.log("");

  const columns = await checkRequiredColumns();
  console.log(`Schema check:`);
  console.log(`  latitude/longitude columns: ${columns.hasLatLng ? "YES" : "NO"}`);
  console.log(`  coordinate_source/precision: ${columns.hasCoordMeta ? "YES" : "NO"}`);
  console.log(`  geocode_cache table: ${columns.hasGeocodeCache ? "YES" : "NO"}`);
  console.log("");

  if (!columns.hasLatLng) {
    console.error("ABORT: latitude/longitude columns do not exist on listings table.");
    console.error("Run migration 015 in Supabase SQL Editor first.");
    console.error("File: server/migrations/PENDING_RUN_IN_SUPABASE.sql");
    process.exit(1);
  }

  const totalCandidates = await countCandidates(opts);
  const effectiveLimit = Math.min(opts.limit, totalCandidates);
  console.log(`Candidates (latitude IS NULL): ${totalCandidates}`);
  console.log(`Will process up to: ${effectiveLimit}`);
  console.log("");

  if (totalCandidates === 0) {
    console.log("No listings need coordinate backfill. Done.");
    process.exit(0);
  }

  const stats: BackfillStats = {
    candidates: totalCandidates,
    processed: 0,
    directCoords: 0,
    geocoded: 0,
    cityFallback: 0,
    unresolved: 0,
    skippedAlreadyGood: 0,
    upgraded: 0,
    errors: 0,
  };

  let offset = 0;
  let totalProcessed = 0;
  let batchNum = 0;

  while (totalProcessed < effectiveLimit) {
    batchNum++;
    const batch = await fetchBatch(opts, 0, columns);

    if (batch.length === 0) {
      console.log(`[Batch ${batchNum}] No more candidates. Stopping.`);
      break;
    }

    console.log(`[Batch ${batchNum}] Processing ${batch.length} listings...`);

    for (const listing of batch) {
      if (totalProcessed >= effectiveLimit) break;

      if (shouldSkip(listing)) {
        stats.skippedAlreadyGood++;
        totalProcessed++;
        continue;
      }

      try {
        const fields = buildGeocodableFields(listing);
        const resolved = await resolveCoordinates(fields);

        if (!resolved) {
          stats.unresolved++;
          totalProcessed++;
          stats.processed++;
          continue;
        }

        const currentPrecision = listing.coordinate_precision ?? null;
        const isUpgradeCase = currentPrecision && isUpgrade(currentPrecision, resolved.coordinate_precision);

        if (listing.latitude != null && listing.longitude != null && !isUpgradeCase) {
          stats.skippedAlreadyGood++;
          totalProcessed++;
          continue;
        }

        if (opts.dryRun) {
          console.log(`  [DRY] ${listing.id} (${listing.source}/${listing.city}): would set ${resolved.coordinate_source}/${resolved.coordinate_precision} → ${resolved.latitude.toFixed(4)}, ${resolved.longitude.toFixed(4)}${isUpgradeCase ? " [UPGRADE]" : ""}`);
        } else {
          const updateData: Record<string, any> = {
            latitude: resolved.latitude,
            longitude: resolved.longitude,
          };
          if (columns.hasCoordMeta) {
            updateData.coordinate_source = resolved.coordinate_source;
            updateData.coordinate_precision = resolved.coordinate_precision;
          }

          const { error: updateErr } = await supabase
            .from("listings")
            .update(updateData)
            .eq("id", listing.id);

          if (updateErr) {
            console.error(`  [ERR] ${listing.id}: ${updateErr.message}`);
            stats.errors++;
            totalProcessed++;
            stats.processed++;
            continue;
          }
        }

        switch (resolved.coordinate_source) {
          case "direct": stats.directCoords++; break;
          case "geocoded": stats.geocoded++; break;
          case "city_fallback": stats.cityFallback++; break;
        }

        if (isUpgradeCase) stats.upgraded++;
        stats.processed++;
        totalProcessed++;
      } catch (err: any) {
        console.error(`  [ERR] ${listing.id}: ${err.message}`);
        stats.errors++;
        totalProcessed++;
        stats.processed++;
      }
    }

    console.log(`[Batch ${batchNum}] Done. Total processed so far: ${totalProcessed}/${effectiveLimit}`);

    if (totalProcessed < effectiveLimit) {
      await new Promise(r => setTimeout(r, opts.pauseBetweenBatchesMs));
    }
  }

  console.log("");
  console.log("=== BACKFILL SUMMARY ===");
  console.log(`Mode:                ${opts.dryRun ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log(`Total candidates:    ${stats.candidates}`);
  console.log(`Processed:           ${stats.processed}`);
  console.log(`Direct coords:       ${stats.directCoords}`);
  console.log(`Geocoded:            ${stats.geocoded}`);
  console.log(`City fallback:       ${stats.cityFallback}`);
  console.log(`Unresolved:          ${stats.unresolved}`);
  console.log(`Skipped (good):      ${stats.skippedAlreadyGood}`);
  console.log(`Upgraded precision:  ${stats.upgraded}`);
  console.log(`Errors:              ${stats.errors}`);
  console.log("========================");

  if (stats.errors > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
