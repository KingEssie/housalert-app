import { createClient } from "@supabase/supabase-js";
import {
  resolveCoordinates,
  extractPostcodeFromText,
  extractStreetFromAddress,
  type GeocodableFields,
} from "../ingesters/geocoding";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

interface UpgradeStats {
  totalCandidates: number;
  uniqueCombos: number;
  geocodedCombos: number;
  cacheHits: number;
  nominatimCalls: number;
  failedCombos: number;
  listingsUpgraded: number;
  upgradedToExact: number;
  upgradedToApproximate: number;
  skippedNoPostcode: number;
  errors: number;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    source: null as string | null,
    limit: 0,
    dryRun: false,
  };
  for (const arg of args) {
    if (arg.startsWith("--source=")) opts.source = arg.split("=")[1];
    else if (arg.startsWith("--limit=")) opts.limit = parseInt(arg.split("=")[1], 10);
    else if (arg === "--dry-run") opts.dryRun = true;
  }
  return opts;
}

async function fetchAllCityFallback(source: string | null): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    let query = supabase
      .from("listings")
      .select("id, source, title, city, district, latitude, longitude, coordinate_source, coordinate_precision")
      .eq("coordinate_source", "city_fallback")
      .order("id", { ascending: true })
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (source) query = query.eq("source", source);
    const { data } = await query;
    if (!data || data.length === 0) break;
    all.push(...data);
    page++;
  }
  return all;
}

interface ComboInfo {
  postcode: string;
  city: string;
  street: string | null;
  district: string | null;
  listingIds: string[];
}

function buildCombos(listings: any[]): { combos: ComboInfo[]; skipped: number } {
  const map = new Map<string, ComboInfo>();
  let skipped = 0;

  for (const listing of listings) {
    let postcode: string | null = null;
    let street: string | null = null;
    let district: string | null = null;

    if (listing.title) {
      postcode = extractPostcodeFromText(listing.title);
      street = extractStreetFromAddress(listing.title, listing.city);
    }
    if (listing.district) {
      if (!postcode) postcode = extractPostcodeFromText(listing.district);
      if (!street) street = extractStreetFromAddress(listing.district, listing.city);
      if (!street) {
        const cleaned = listing.district.replace(/\(\d{5}\)/, "").replace(/\d{5}/, "").trim();
        if (cleaned.length > 2 && cleaned !== listing.city) district = cleaned;
      }
    }

    if (!postcode && !street && !district) {
      skipped++;
      continue;
    }

    const key = [postcode || "", listing.city, street || ""].join("|");
    if (!map.has(key)) {
      map.set(key, { postcode: postcode || "", city: listing.city, street, district, listingIds: [] });
    }
    map.get(key)!.listingIds.push(listing.id);
  }

  return { combos: Array.from(map.values()), skipped };
}

async function run() {
  const opts = parseArgs();

  console.log("=== PRECISION UPGRADE ===");
  console.log(`Mode: ${opts.dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Source: ${opts.source ?? "all"}`);
  console.log(`Combo limit: ${opts.limit || "none"}`);
  console.log("");

  const stats: UpgradeStats = {
    totalCandidates: 0, uniqueCombos: 0, geocodedCombos: 0,
    cacheHits: 0, nominatimCalls: 0, failedCombos: 0,
    listingsUpgraded: 0, upgradedToExact: 0, upgradedToApproximate: 0,
    skippedNoPostcode: 0, errors: 0,
  };

  console.log("Fetching city_fallback listings...");
  const listings = await fetchAllCityFallback(opts.source);
  stats.totalCandidates = listings.length;
  console.log(`Found ${listings.length} city_fallback listings`);

  console.log("Building unique geocodable combos...");
  const { combos, skipped } = buildCombos(listings);
  stats.skippedNoPostcode = skipped;
  stats.uniqueCombos = combos.length;

  const sortedCombos = combos.sort((a, b) => b.listingIds.length - a.listingIds.length);

  const effectiveCombos = opts.limit > 0 ? sortedCombos.slice(0, opts.limit) : sortedCombos;

  console.log(`Unique combos: ${combos.length} (covering ${combos.reduce((s, c) => s + c.listingIds.length, 0)} listings)`);
  console.log(`Skipped (no extractable data): ${skipped}`);
  console.log(`Will process: ${effectiveCombos.length} combos`);
  console.log("");

  let comboNum = 0;
  for (const combo of effectiveCombos) {
    comboNum++;

    const fields: GeocodableFields = {
      city: combo.city,
      postcode: combo.postcode || undefined,
      street: combo.street || undefined,
      district: combo.district || undefined,
      latitude: null,
      longitude: null,
    };

    try {
      const resolved = await resolveCoordinates(fields);

      if (!resolved || resolved.coordinate_source === "city_fallback") {
        stats.failedCombos++;
        if (comboNum % 50 === 0 || comboNum <= 5) {
          console.log(`  [${comboNum}/${effectiveCombos.length}] ${combo.postcode} ${combo.city}${combo.street ? " / " + combo.street : ""}: no improvement (${combo.listingIds.length} listings)`);
        }
        continue;
      }

      stats.geocodedCombos++;
      const precision = resolved.coordinate_precision;
      const affectedCount = combo.listingIds.length;

      if (comboNum % 20 === 0 || comboNum <= 10 || affectedCount >= 10) {
        console.log(`  [${comboNum}/${effectiveCombos.length}] ${combo.postcode} ${combo.city}${combo.street ? " / " + combo.street : ""}: → ${precision} (${resolved.latitude.toFixed(4)}, ${resolved.longitude.toFixed(4)}) [${affectedCount} listings]`);
      }

      if (!opts.dryRun) {
        const CHUNK = 100;
        for (let i = 0; i < combo.listingIds.length; i += CHUNK) {
          const chunk = combo.listingIds.slice(i, i + CHUNK);
          const { error } = await supabase
            .from("listings")
            .update({
              latitude: resolved.latitude,
              longitude: resolved.longitude,
              coordinate_source: resolved.coordinate_source,
              coordinate_precision: resolved.coordinate_precision,
            })
            .in("id", chunk);

          if (error) {
            console.error(`  [ERR] Bulk update failed: ${error.message}`);
            stats.errors++;
          }
        }
      }

      stats.listingsUpgraded += affectedCount;
      if (precision === "exact") stats.upgradedToExact += affectedCount;
      else if (precision === "approximate") stats.upgradedToApproximate += affectedCount;

    } catch (err: any) {
      console.error(`  [ERR] ${combo.postcode} ${combo.city}: ${err.message}`);
      stats.errors++;
    }
  }

  console.log("");
  console.log("=== UPGRADE SUMMARY ===");
  console.log(`Mode:                  ${opts.dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Source:                ${opts.source ?? "all"}`);
  console.log(`Total candidates:      ${stats.totalCandidates}`);
  console.log(`Unique combos:         ${stats.uniqueCombos}`);
  console.log(`Combos processed:      ${effectiveCombos.length}`);
  console.log(`Combos geocoded:       ${stats.geocodedCombos}`);
  console.log(`Combos failed:         ${stats.failedCombos}`);
  console.log(`Listings upgraded:     ${stats.listingsUpgraded}`);
  console.log(`  → to exact:          ${stats.upgradedToExact}`);
  console.log(`  → to approximate:    ${stats.upgradedToApproximate}`);
  console.log(`Skipped (no data):     ${stats.skippedNoPostcode}`);
  console.log(`Errors:                ${stats.errors}`);
  console.log("========================");
}

run().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
