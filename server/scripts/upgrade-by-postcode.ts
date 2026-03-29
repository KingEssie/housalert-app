import { createClient } from "@supabase/supabase-js";
import {
  extractPostcodeFromText,
  type GeocodableFields,
} from "../ingesters/geocoding";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_UA = "HousAlert/1.0 (rental-alert-app)";
const DELAY_MS = 1100;

async function geocodePostcode(postcode: string, city: string): Promise<{ lat: number; lng: number } | null> {
  const cacheKey = `${postcode}|${city.toLowerCase()}`;
  const { data: cached } = await supabase
    .from("geocode_cache")
    .select("latitude, longitude")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (cached) return { lat: cached.latitude, lng: cached.longitude };

  await new Promise(r => setTimeout(r, DELAY_MS));

  const query = `${postcode}, ${city}`;
  try {
    const resp = await fetch(`${NOMINATIM_BASE}?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=de,at,ch,nl`, {
      headers: { "User-Agent": NOMINATIM_UA, "Accept": "application/json" },
    });

    if (resp.status === 429) {
      console.log(`  429 for "${query}" — waiting 5s`);
      await new Promise(r => setTimeout(r, 5000));
      return null;
    }

    if (!resp.ok) return null;

    const results = await resp.json() as Array<{ lat: string; lon: string }>;
    if (results.length === 0) return null;

    const lat = parseFloat(results[0].lat);
    const lng = parseFloat(results[0].lon);
    if (isNaN(lat) || isNaN(lng)) return null;

    await supabase.from("geocode_cache").upsert(
      { cache_key: cacheKey, latitude: lat, longitude: lng, updated_at: new Date().toISOString() },
      { onConflict: "cache_key" }
    );

    return { lat, lng };
  } catch (err: any) {
    console.error(`  Error geocoding "${query}": ${err.message}`);
    return null;
  }
}

async function run() {
  const args = process.argv.slice(2);
  let source: string | null = null;
  let limit = 0;
  let dryRun = false;
  for (const arg of args) {
    if (arg.startsWith("--source=")) source = arg.split("=")[1];
    else if (arg.startsWith("--limit=")) limit = parseInt(arg.split("=")[1], 10);
    else if (arg === "--dry-run") dryRun = true;
  }

  console.log(`=== POSTCODE PRECISION UPGRADE ===`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Source: ${source ?? "all"}`);
  console.log("");

  const all: any[] = [];
  let page = 0;
  while (true) {
    let q = supabase.from("listings")
      .select("id, title, city")
      .eq("coordinate_source", "city_fallback")
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (source) q = q.eq("source", source);
    const { data } = await q;
    if (!data || data.length === 0) break;
    all.push(...data);
    page++;
  }

  console.log(`Total city_fallback listings: ${all.length}`);

  const pcGroups = new Map<string, { postcode: string; city: string; ids: string[] }>();
  let noPostcode = 0;

  for (const listing of all) {
    const pc = listing.title ? extractPostcodeFromText(listing.title) : null;
    if (!pc) { noPostcode++; continue; }
    const key = `${pc}|${listing.city}`;
    if (!pcGroups.has(key)) pcGroups.set(key, { postcode: pc, city: listing.city, ids: [] });
    pcGroups.get(key)!.ids.push(listing.id);
  }

  const sorted = Array.from(pcGroups.values()).sort((a, b) => b.ids.length - a.ids.length);
  const effective = limit > 0 ? sorted.slice(0, limit) : sorted;

  console.log(`Unique postcode+city combos: ${sorted.length}`);
  console.log(`Listings with postcode: ${sorted.reduce((s, g) => s + g.ids.length, 0)}`);
  console.log(`No postcode: ${noPostcode}`);
  console.log(`Processing: ${effective.length} combos`);
  console.log("");

  let totalUpgraded = 0;
  let totalCombosSuccess = 0;
  let totalCombosFailed = 0;
  let errors = 0;
  let cacheHits = 0;

  for (let i = 0; i < effective.length; i++) {
    const group = effective[i];

    const result = await geocodePostcode(group.postcode, group.city);

    if (!result) {
      totalCombosFailed++;
      continue;
    }

    totalCombosSuccess++;

    const hasStreetData = false;
    const precision = "approximate";

    if (dryRun) {
      console.log(`  [${i + 1}/${effective.length}] ${group.postcode} ${group.city} → ${result.lat.toFixed(4)}, ${result.lng.toFixed(4)} [${group.ids.length} listings]`);
    } else {
      const CHUNK = 200;
      for (let j = 0; j < group.ids.length; j += CHUNK) {
        const chunk = group.ids.slice(j, j + CHUNK);
        const { error } = await supabase
          .from("listings")
          .update({
            latitude: result.lat,
            longitude: result.lng,
            coordinate_source: "geocoded",
            coordinate_precision: precision,
          })
          .in("id", chunk);

        if (error) {
          console.error(`  [ERR] Bulk update: ${error.message}`);
          errors++;
        }
      }

      if ((i + 1) % 25 === 0 || i < 5 || i === effective.length - 1) {
        console.log(`  [${i + 1}/${effective.length}] ${group.postcode} ${group.city} → ${result.lat.toFixed(4)}, ${result.lng.toFixed(4)} [${group.ids.length} listings] | Total upgraded: ${totalUpgraded + group.ids.length}`);
      }
    }

    totalUpgraded += group.ids.length;
  }

  console.log("");
  console.log("=== SUMMARY ===");
  console.log(`Mode:                ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Total candidates:    ${all.length}`);
  console.log(`Combos geocoded:     ${totalCombosSuccess}`);
  console.log(`Combos failed:       ${totalCombosFailed}`);
  console.log(`Listings upgraded:   ${totalUpgraded}`);
  console.log(`No postcode:         ${noPostcode}`);
  console.log(`Errors:              ${errors}`);
  console.log("================");
}

run().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
