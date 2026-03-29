import { createClient } from "@supabase/supabase-js";
import {
  resolveCoordinates,
  resolveCoordinatesCityOnly,
  CITY_CENTER_COORDS,
  normalizeCityKey,
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
  skipNominatim: boolean;
  pauseBetweenBatchesMs: number;
  upgrade: boolean;
}

interface BackfillStats {
  candidates: number;
  processed: number;
  directCoords: number;
  geocoded: number;
  cityFallback: number;
  unresolved: number;
  skippedAlreadyGood: number;
  skippedNoData: number;
  upgraded: number;
  upgradedToExact: number;
  upgradedToApproximate: number;
  errors: number;
}

function emptyStats(): BackfillStats {
  return {
    candidates: 0, processed: 0, directCoords: 0, geocoded: 0,
    cityFallback: 0, unresolved: 0, skippedAlreadyGood: 0, skippedNoData: 0,
    upgraded: 0, upgradedToExact: 0, upgradedToApproximate: 0, errors: 0,
  };
}

function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2);
  const opts: BackfillOptions = {
    limit: 500,
    batchSize: 50,
    source: null,
    dryRun: false,
    recentOnly: false,
    skipNominatim: false,
    pauseBetweenBatchesMs: 2000,
    upgrade: false,
  };

  for (const arg of args) {
    if (arg.startsWith("--limit=")) opts.limit = parseInt(arg.split("=")[1], 10);
    else if (arg.startsWith("--batch=")) opts.batchSize = parseInt(arg.split("=")[1], 10);
    else if (arg.startsWith("--source=")) opts.source = arg.split("=")[1];
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--recent-only") opts.recentOnly = true;
    else if (arg === "--skip-nominatim") opts.skipNominatim = true;
    else if (arg.startsWith("--pause=")) opts.pauseBetweenBatchesMs = parseInt(arg.split("=")[1], 10);
    else if (arg === "--upgrade") opts.upgrade = true;
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

function isUpgrade(currentPrecision: string | null, newPrecision: CoordinatePrecision): boolean {
  const currentRank = PRECISION_RANK[currentPrecision ?? ""] ?? 0;
  const newRank = PRECISION_RANK[newPrecision] ?? 0;
  return newRank > currentRank;
}

async function runBulkCityFallback(opts: BackfillOptions, columns: { hasCoordMeta: boolean }): Promise<BackfillStats> {
  const stats = emptyStats();

  let query = supabase
    .from("listings")
    .select("city", { count: "exact" })
    .is("latitude", null);

  if (opts.source) query = query.eq("source", opts.source);
  if (opts.recentOnly) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("created_at", sevenDaysAgo);
  }

  const { data: allRows, count } = await query;
  stats.candidates = count ?? 0;

  if (!allRows || allRows.length === 0) {
    console.log("No candidates found.");
    return stats;
  }

  const cityGroups = new Map<string, number>();
  for (const row of allRows) {
    cityGroups.set(row.city, (cityGroups.get(row.city) || 0) + 1);
  }

  console.log(`Found ${cityGroups.size} distinct cities across ${stats.candidates} candidate listings`);
  console.log("");

  let totalUpdated = 0;

  for (const [city, rowCount] of Array.from(cityGroups.entries()).sort((a, b) => b[1] - a[1])) {
    if (opts.limit > 0 && totalUpdated >= opts.limit) break;

    const key = normalizeCityKey(city);
    const coords = CITY_CENTER_COORDS[key];

    if (!coords) {
      console.log(`  [SKIP] "${city}" (${rowCount} rows) — not in city center table`);
      stats.unresolved += rowCount;
      continue;
    }

    if (opts.dryRun) {
      console.log(`  [DRY] "${city}" (${rowCount} rows) → ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)} city_fallback/city_level`);
      stats.cityFallback += rowCount;
      stats.processed += rowCount;
      totalUpdated += rowCount;
      continue;
    }

    const updateData: Record<string, any> = { latitude: coords.lat, longitude: coords.lng };
    if (columns.hasCoordMeta) {
      updateData.coordinate_source = "city_fallback";
      updateData.coordinate_precision = "city_level";
    }

    let updateQuery = supabase.from("listings").update(updateData).eq("city", city).is("latitude", null);
    if (opts.source) updateQuery = updateQuery.eq("source", opts.source);

    const { error, count: updatedCount } = await updateQuery.select("id", { count: "exact", head: true });

    if (error) {
      console.error(`  [ERR] "${city}": ${error.message}`);
      stats.errors += rowCount;
      continue;
    }

    const affected = updatedCount ?? rowCount;
    console.log(`  [OK] "${city}": ${affected} rows → ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
    stats.cityFallback += affected;
    stats.processed += affected;
    totalUpdated += affected;
  }

  return stats;
}

function extractUpgradeFields(listing: any): GeocodableFields | null {
  const city = listing.city;
  if (!city) return null;

  let postcode: string | null = null;
  let street: string | null = null;
  let district: string | null = null;

  if (listing.title) {
    postcode = extractPostcodeFromText(listing.title);
    street = extractStreetFromAddress(listing.title, city);
  }

  if (listing.district) {
    const distPostcode = extractPostcodeFromText(listing.district);
    if (distPostcode && !postcode) postcode = distPostcode;

    const distStreet = extractStreetFromAddress(listing.district, city);
    if (distStreet && !street) street = distStreet;

    if (!street && !distStreet) {
      const cleaned = listing.district.replace(/\(\d{5}\)/, "").replace(/\d{5}/, "").trim();
      if (cleaned.length > 2 && cleaned !== city) {
        district = cleaned;
      }
    }
  }

  if (!postcode && !street && !district) return null;

  return {
    city,
    postcode,
    street,
    district,
    latitude: null,
    longitude: null,
  };
}

async function runUpgrade(opts: BackfillOptions, columns: { hasCoordMeta: boolean }): Promise<BackfillStats> {
  const stats = emptyStats();

  let countQuery = supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("coordinate_source", "city_fallback");
  if (opts.source) countQuery = countQuery.eq("source", opts.source);

  const { count } = await countQuery;
  stats.candidates = count ?? 0;

  const effectiveLimit = Math.min(opts.limit, stats.candidates);
  console.log(`City-fallback candidates: ${stats.candidates}`);
  console.log(`Will evaluate up to: ${effectiveLimit}`);
  console.log("");

  if (stats.candidates === 0) {
    console.log("No city_fallback listings to upgrade.");
    return stats;
  }

  let totalProcessed = 0;
  let batchNum = 0;
  let lastId: string | null = null;

  while (totalProcessed < effectiveLimit) {
    batchNum++;

    let fetchQuery = supabase
      .from("listings")
      .select("id, source, title, city, district, latitude, longitude, coordinate_source, coordinate_precision")
      .eq("coordinate_source", "city_fallback")
      .order("id", { ascending: true })
      .limit(opts.batchSize);

    if (opts.source) fetchQuery = fetchQuery.eq("source", opts.source);
    if (lastId) fetchQuery = fetchQuery.gt("id", lastId);

    const { data: batch, error: fetchErr } = await fetchQuery;
    if (fetchErr) {
      console.error(`[Batch ${batchNum}] Fetch error: ${fetchErr.message}`);
      stats.errors++;
      break;
    }
    if (!batch || batch.length === 0) {
      console.log(`[Batch ${batchNum}] No more candidates.`);
      break;
    }

    lastId = batch[batch.length - 1].id;

    let batchUpgraded = 0;
    let batchSkipped = 0;
    let batchNoData = 0;

    for (const listing of batch) {
      if (totalProcessed >= effectiveLimit) break;
      totalProcessed++;
      stats.processed++;

      const fields = extractUpgradeFields(listing);
      if (!fields) {
        batchNoData++;
        stats.skippedNoData++;
        continue;
      }

      try {
        const resolved = await resolveCoordinates(fields);

        if (!resolved || resolved.coordinate_source === "city_fallback") {
          batchSkipped++;
          stats.cityFallback++;
          continue;
        }

        if (!isUpgrade(listing.coordinate_precision, resolved.coordinate_precision)) {
          batchSkipped++;
          stats.skippedAlreadyGood++;
          continue;
        }

        if (opts.dryRun) {
          console.log(`  [DRY] ${listing.id} (${listing.source}/${listing.city}): ${listing.coordinate_precision} → ${resolved.coordinate_precision} (${resolved.coordinate_source}) ${resolved.latitude.toFixed(4)}, ${resolved.longitude.toFixed(4)}`);
        } else {
          const { error: updateErr } = await supabase
            .from("listings")
            .update({
              latitude: resolved.latitude,
              longitude: resolved.longitude,
              coordinate_source: resolved.coordinate_source,
              coordinate_precision: resolved.coordinate_precision,
            })
            .eq("id", listing.id);

          if (updateErr) {
            console.error(`  [ERR] ${listing.id}: ${updateErr.message}`);
            stats.errors++;
            continue;
          }
        }

        batchUpgraded++;
        stats.upgraded++;
        stats.geocoded++;

        if (resolved.coordinate_precision === "exact") stats.upgradedToExact++;
        else if (resolved.coordinate_precision === "approximate") stats.upgradedToApproximate++;

      } catch (err: any) {
        console.error(`  [ERR] ${listing.id}: ${err.message}`);
        stats.errors++;
      }
    }

    console.log(`[Batch ${batchNum}] ${batch.length} evaluated, ${batchUpgraded} upgraded, ${batchNoData} no data, ${batchSkipped} skipped | Total: ${totalProcessed}/${effectiveLimit}`);

    if (totalProcessed < effectiveLimit && batch.length === opts.batchSize) {
      await new Promise(r => setTimeout(r, opts.pauseBetweenBatchesMs));
    }
  }

  return stats;
}

async function runRowByRow(opts: BackfillOptions, columns: { hasCoordMeta: boolean }): Promise<BackfillStats> {
  const stats = emptyStats();

  let countQuery = supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .is("latitude", null);
  if (opts.source) countQuery = countQuery.eq("source", opts.source);
  if (opts.recentOnly) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    countQuery = countQuery.gte("created_at", sevenDaysAgo);
  }
  const { count } = await countQuery;
  stats.candidates = count ?? 0;

  const effectiveLimit = Math.min(opts.limit, stats.candidates);
  console.log(`Candidates (latitude IS NULL): ${stats.candidates}`);
  console.log(`Will process up to: ${effectiveLimit}`);
  console.log("");

  if (stats.candidates === 0) {
    console.log("No listings need coordinate backfill. Done.");
    return stats;
  }

  let totalProcessed = 0;
  let batchNum = 0;

  while (totalProcessed < effectiveLimit) {
    batchNum++;
    const selectCols = "id, source, url, title, city, district, latitude, longitude" +
      (columns.hasCoordMeta ? ", coordinate_source, coordinate_precision" : "");

    let fetchQuery = supabase
      .from("listings")
      .select(selectCols)
      .is("latitude", null)
      .order("created_at", { ascending: false })
      .limit(opts.batchSize);
    if (opts.source) fetchQuery = fetchQuery.eq("source", opts.source);
    if (opts.recentOnly) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      fetchQuery = fetchQuery.gte("created_at", sevenDaysAgo);
    }

    const { data: batch, error: fetchErr } = await fetchQuery;
    if (fetchErr || !batch || batch.length === 0) {
      console.log(`[Batch ${batchNum}] No more candidates. Stopping.`);
      break;
    }

    console.log(`[Batch ${batchNum}] Processing ${batch.length} listings...`);

    for (const listing of batch) {
      if (totalProcessed >= effectiveLimit) break;

      if (listing.coordinate_precision === "exact" || listing.coordinate_source === "direct") {
        stats.skippedAlreadyGood++;
        totalProcessed++;
        continue;
      }

      try {
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

        const resolved = await resolveCoordinates(fields);

        if (!resolved) {
          stats.unresolved++;
          totalProcessed++;
          stats.processed++;
          continue;
        }

        const currentPrecision = listing.coordinate_precision ?? null;
        const upgradeCase = currentPrecision && isUpgrade(currentPrecision, resolved.coordinate_precision);

        if (listing.latitude != null && listing.longitude != null && !upgradeCase) {
          stats.skippedAlreadyGood++;
          totalProcessed++;
          continue;
        }

        if (opts.dryRun) {
          console.log(`  [DRY] ${listing.id} (${listing.source}/${listing.city}): would set ${resolved.coordinate_source}/${resolved.coordinate_precision} → ${resolved.latitude.toFixed(4)}, ${resolved.longitude.toFixed(4)}${upgradeCase ? " [UPGRADE]" : ""}`);
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

        if (upgradeCase) stats.upgraded++;
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

  return stats;
}

async function run() {
  const opts = parseArgs();

  console.log("=== COORDINATE BACKFILL ===");
  console.log(`Mode: ${opts.dryRun ? "DRY RUN" : "LIVE"}${opts.upgrade ? " [UPGRADE]" : ""}`);
  console.log(`Limit: ${opts.limit}`);
  console.log(`Batch size: ${opts.batchSize}`);
  console.log(`Source filter: ${opts.source ?? "all"}`);
  console.log(`Recent only: ${opts.recentOnly}`);
  console.log(`Skip Nominatim: ${opts.skipNominatim}`);
  console.log(`Upgrade mode: ${opts.upgrade}`);
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
    process.exit(1);
  }

  let stats: BackfillStats;

  if (opts.upgrade) {
    stats = await runUpgrade(opts, columns);
  } else if (opts.skipNominatim) {
    stats = await runBulkCityFallback(opts, columns);
  } else {
    stats = await runRowByRow(opts, columns);
  }

  console.log("");
  console.log("=== BACKFILL SUMMARY ===");
  console.log(`Mode:                ${opts.dryRun ? "DRY RUN (no writes)" : "LIVE"}${opts.upgrade ? " [UPGRADE]" : ""}`);
  console.log(`Total candidates:    ${stats.candidates}`);
  console.log(`Processed:           ${stats.processed}`);
  if (opts.upgrade) {
    console.log(`Upgraded total:      ${stats.upgraded}`);
    console.log(`  → to exact:        ${stats.upgradedToExact}`);
    console.log(`  → to approximate:  ${stats.upgradedToApproximate}`);
    console.log(`Skipped (no data):   ${stats.skippedNoData}`);
    console.log(`Remained city_level: ${stats.cityFallback}`);
  } else {
    console.log(`Direct coords:       ${stats.directCoords}`);
    console.log(`Geocoded:            ${stats.geocoded}`);
    console.log(`City fallback:       ${stats.cityFallback}`);
    console.log(`Unresolved:          ${stats.unresolved}`);
    console.log(`Skipped (good):      ${stats.skippedAlreadyGood}`);
    console.log(`Upgraded precision:  ${stats.upgraded}`);
  }
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
