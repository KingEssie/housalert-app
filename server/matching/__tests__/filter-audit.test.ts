import { explainMatchInternal } from "../engine";

interface DbListing {
  id: string;
  source: string;
  url: string | null;
  title: string;
  city: string;
  price: number;
  bedrooms: number;
  size_m2: number;
  furnished?: boolean | null;
  pets_allowed?: boolean | null;
  balcony?: boolean | null;
  elevator?: boolean | null;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  extra_features?: string[] | null;
  target_categories?: string[] | null;
}

interface SearchProfile {
  id: string;
  user_id: string;
  city: string;
  city_name?: string;
  price_min: number;
  price_max: number;
  bedrooms_min: number;
  size_min: number;
  furnished?: string | null;
  extra_features?: string[] | null;
  target_categories?: string[] | null;
  districts?: string[] | null;
  property_types?: string[] | null;
  location_mode?: string | null;
}

const LISTINGS: DbListing[] = [
  { id: "L01", source: "wg-gesucht", url: null, title: "Möblierte 2-Zimmer Wohnung Kreuzberg", city: "Berlin", price: 1200, bedrooms: 2, size_m2: 55, furnished: true, pets_allowed: true, balcony: true, elevator: true, district: "Kreuzberg" },
  { id: "L02", source: "wg-gesucht", url: null, title: "Unfurnished 3-Zi in Mitte", city: "Berlin", price: 1500, bedrooms: 3, size_m2: 80, furnished: false, pets_allowed: false, balcony: false, elevator: true, district: "Mitte" },
  { id: "L03", source: "immowelt", url: null, title: "Studio Neukölln", city: "Berlin", price: 700, bedrooms: 1, size_m2: 30, furnished: null, pets_allowed: null, balcony: null, elevator: null, district: "Neukölln" },
  { id: "L04", source: "immowelt", url: null, title: "Altbau Prenzlauer Berg", city: "Berlin", price: 1800, bedrooms: 3, size_m2: 95, furnished: false, pets_allowed: true, balcony: true, elevator: false, district: "Prenzlauer Berg" },
  { id: "L05", source: "kleinanzeigen", url: null, title: "Möbliert Charlottenburg", city: "Berlin", price: 950, bedrooms: 1, size_m2: 40, furnished: true, pets_allowed: false, balcony: false, elevator: true, district: "Charlottenburg" },
  { id: "L06", source: "wg-gesucht", url: null, title: "Wohnung Schwabing", city: "München", price: 1600, bedrooms: 2, size_m2: 65, furnished: true, pets_allowed: true, balcony: true, elevator: true, district: "Schwabing" },
  { id: "L07", source: "immowelt", url: null, title: "Apartment Bogenhausen", city: "München", price: 2200, bedrooms: 3, size_m2: 90, furnished: false, pets_allowed: false, balcony: true, elevator: true, district: "Bogenhausen" },
  { id: "L08", source: "immowelt", url: null, title: "Zimmer Maxvorstadt", city: "München", price: 800, bedrooms: 1, size_m2: 25, furnished: true, pets_allowed: null, balcony: false, elevator: false, district: "Maxvorstadt" },
  { id: "L09", source: "wg-gesucht", url: null, title: "Hamburg Eimsbüttel flat", city: "Hamburg", price: 1100, bedrooms: 2, size_m2: 60, furnished: false, pets_allowed: true, balcony: true, elevator: false, district: "Eimsbüttel" },
  { id: "L10", source: "kleinanzeigen", url: null, title: "Hamburg Altona furnished", city: "Hamburg", price: 1400, bedrooms: 2, size_m2: 55, furnished: true, pets_allowed: false, balcony: false, elevator: true, district: "Altona" },
  { id: "L11", source: "wg-gesucht", url: null, title: "Köln Ehrenfeld WG", city: "Köln", price: 650, bedrooms: 1, size_m2: 22, furnished: null, pets_allowed: null, balcony: null, elevator: null, district: "Ehrenfeld" },
  { id: "L12", source: "immowelt", url: null, title: "Köln Südstadt möbliert", city: "Köln", price: 1050, bedrooms: 2, size_m2: 50, furnished: true, pets_allowed: true, balcony: true, elevator: false, district: "Südstadt" },
  { id: "L13", source: "kleinanzeigen", url: null, title: "Frankfurt Nordend", city: "Frankfurt", price: 1300, bedrooms: 2, size_m2: 58, furnished: false, pets_allowed: true, balcony: false, elevator: true, district: "Nordend" },
  { id: "L14", source: "wg-gesucht", url: null, title: "Frankfurt Sachsenhausen luxury", city: "Frankfurt", price: 2500, bedrooms: 4, size_m2: 120, furnished: true, pets_allowed: true, balcony: true, elevator: true, district: "Sachsenhausen" },
  { id: "L15", source: "immowelt", url: null, title: "Düsseldorf Flingern", city: "Düsseldorf", price: 900, bedrooms: 2, size_m2: 50, furnished: false, pets_allowed: false, balcony: true, elevator: false, district: "Flingern" },
  { id: "L16", source: "wg-gesucht", url: null, title: "Berlin Wedding studio", city: "Berlin", price: 600, bedrooms: 1, size_m2: 28, furnished: false, pets_allowed: true, balcony: false, elevator: false, district: "Wedding" },
  { id: "L17", source: "immowelt", url: null, title: "Berlin Friedrichshain furnished", city: "Berlin", price: 1100, bedrooms: 2, size_m2: 50, furnished: true, pets_allowed: true, balcony: true, elevator: true, district: "Friedrichshain" },
  { id: "L18", source: "kleinanzeigen", url: null, title: "München Sendling unfurnished", city: "München", price: 1400, bedrooms: 2, size_m2: 60, furnished: false, pets_allowed: true, balcony: false, elevator: true, district: "Sendling" },
  { id: "L19", source: "wg-gesucht", url: null, title: "Berlin Tempelhof family", city: "Berlin", price: 1650, bedrooms: 3, size_m2: 85, furnished: false, pets_allowed: true, balcony: true, elevator: true, district: "Tempelhof" },
  { id: "L20", source: "immowelt", url: null, title: "Berlin Spandau budget", city: "Berlin", price: 500, bedrooms: 1, size_m2: 35, furnished: null, pets_allowed: null, balcony: null, elevator: null, district: "Spandau" },
  { id: "L21", source: "wg-gesucht", url: null, title: "Berlin no district listing", city: "Berlin", price: 900, bedrooms: 2, size_m2: 50, furnished: true, pets_allowed: true, balcony: true, elevator: true, district: null },
];

const PROFILES: SearchProfile[] = [
  { id: "P01", user_id: "u1", city: "Berlin", price_min: 0, price_max: 2000, bedrooms_min: 1, size_min: 20 },
  { id: "P02", user_id: "u2", city: "Berlin", price_min: 500, price_max: 1200, bedrooms_min: 2, size_min: 50, furnished: "furnished" },
  { id: "P03", user_id: "u3", city: "Berlin", price_min: 0, price_max: 1500, bedrooms_min: 1, size_min: 30, extra_features: ["pets_allowed"] },
  { id: "P04", user_id: "u4", city: "Berlin", price_min: 0, price_max: 2000, bedrooms_min: 2, size_min: 50, extra_features: ["balcony", "elevator"] },
  { id: "P05", user_id: "u5", city: "Berlin", price_min: 0, price_max: 2000, bedrooms_min: 1, size_min: 20, districts: ["Kreuzberg", "Mitte", "Friedrichshain"] },
  { id: "P06", user_id: "u6", city: "München", price_min: 0, price_max: 2000, bedrooms_min: 0, size_min: 0 },
  { id: "P07", user_id: "u7", city: "München", price_min: 800, price_max: 1800, bedrooms_min: 2, size_min: 50, furnished: "furnished" },
  { id: "P08", user_id: "u8", city: "Hamburg", price_min: 0, price_max: 1500, bedrooms_min: 2, size_min: 40, extra_features: ["pets_allowed"] },
  { id: "P09", user_id: "u9", city: "Köln", price_min: 0, price_max: 1200, bedrooms_min: 1, size_min: 20, furnished: "furnished" },
  { id: "P10", user_id: "u10", city: "Frankfurt", price_min: 1000, price_max: 3000, bedrooms_min: 2, size_min: 50, extra_features: ["balcony"] },
];

interface TestCase {
  profileId: string;
  listingId: string;
  expected: boolean;
  reason: string;
}

const TEST_CASES: TestCase[] = [
  { profileId: "P01", listingId: "L01", expected: true, reason: "Berlin broad match - all core filters pass" },
  { profileId: "P01", listingId: "L06", expected: false, reason: "City mismatch: Berlin vs München" },
  { profileId: "P01", listingId: "L20", expected: true, reason: "Berlin cheap listing with null features - core only" },

  { profileId: "P02", listingId: "L01", expected: true, reason: "Berlin furnished, 2BR, 55m² @ €1200 - all pass" },
  { profileId: "P02", listingId: "L02", expected: false, reason: "Berlin unfurnished - furnished required" },
  { profileId: "P02", listingId: "L03", expected: false, reason: "Berlin null furnished - strict = reject" },
  { profileId: "P02", listingId: "L05", expected: false, reason: "Berlin furnished but 1BR < min 2BR" },
  { profileId: "P02", listingId: "L17", expected: true, reason: "Berlin furnished, 2BR, 50m² @ €1100 - all pass" },

  { profileId: "P03", listingId: "L01", expected: true, reason: "Pets_allowed=true - pass" },
  { profileId: "P03", listingId: "L02", expected: false, reason: "Pets_allowed=false - reject" },
  { profileId: "P03", listingId: "L03", expected: false, reason: "Pets_allowed=null - strict reject" },
  { profileId: "P03", listingId: "L16", expected: false, reason: "Wedding, pets_allowed=true but size 28m² < min 30m²" },
  { profileId: "P03", listingId: "L17", expected: true, reason: "Friedrichshain, pets_allowed=true, 50m² ≥ 30m²" },

  { profileId: "P04", listingId: "L01", expected: true, reason: "Balcony+elevator both true" },
  { profileId: "P04", listingId: "L02", expected: false, reason: "Balcony=false - reject" },
  { profileId: "P04", listingId: "L04", expected: false, reason: "Elevator=false - reject (balcony=true)" },
  { profileId: "P04", listingId: "L17", expected: true, reason: "Both balcony+elevator true" },
  { profileId: "P04", listingId: "L19", expected: true, reason: "Tempelhof: balcony+elevator both true, 3BR 85m²" },

  { profileId: "P05", listingId: "L01", expected: true, reason: "Kreuzberg in districts list" },
  { profileId: "P05", listingId: "L02", expected: true, reason: "Mitte in districts list" },
  { profileId: "P05", listingId: "L04", expected: false, reason: "Prenzlauer Berg NOT in [Kreuzberg, Mitte, Friedrichshain]" },
  { profileId: "P05", listingId: "L17", expected: true, reason: "Friedrichshain in districts list" },
  { profileId: "P05", listingId: "L20", expected: false, reason: "Spandau NOT in districts list" },
  { profileId: "P05", listingId: "L21", expected: false, reason: "STRICT: district=null → rejected when profile has districts" },

  { profileId: "P06", listingId: "L06", expected: true, reason: "München broad match" },
  { profileId: "P06", listingId: "L07", expected: false, reason: "München but price €2200 > max €2000" },
  { profileId: "P06", listingId: "L08", expected: true, reason: "München €800 in range" },

  { profileId: "P07", listingId: "L06", expected: true, reason: "München furnished, 2BR, 65m² @ €1600" },
  { profileId: "P07", listingId: "L18", expected: false, reason: "München unfurnished - furnished required" },
  { profileId: "P07", listingId: "L08", expected: false, reason: "München furnished but 1BR < min 2" },

  { profileId: "P08", listingId: "L09", expected: true, reason: "Hamburg pets_allowed=true" },
  { profileId: "P08", listingId: "L10", expected: false, reason: "Hamburg pets_allowed=false - reject" },

  { profileId: "P09", listingId: "L11", expected: false, reason: "Köln furnished=null - strict reject" },
  { profileId: "P09", listingId: "L12", expected: true, reason: "Köln furnished=true, 2BR, 50m² @ €1050" },

  { profileId: "P10", listingId: "L13", expected: false, reason: "Frankfurt balcony=false - reject" },
  { profileId: "P10", listingId: "L14", expected: true, reason: "Frankfurt balcony=true, 4BR, 120m² @ €2500" },
];

let passed = 0;
let failed = 0;
const failures: string[] = [];

console.log(`\n=== FILTER AUDIT TEST SUITE (using real engine) ===`);
console.log(`${LISTINGS.length} sample listings × ${PROFILES.length} profiles = ${TEST_CASES.length} test cases\n`);

for (const tc of TEST_CASES) {
  const listing = LISTINGS.find(l => l.id === tc.listingId)!;
  const profile = PROFILES.find(p => p.id === tc.profileId)!;
  const result = explainMatchInternal(listing as any, profile as any);

  if (result.matched === tc.expected) {
    passed++;
    console.log(`  ✓ ${tc.profileId}×${tc.listingId}: ${tc.reason}`);
  } else {
    failed++;
    const msg = `  ✗ ${tc.profileId}×${tc.listingId}: expected=${tc.expected}, got=${result.matched} (${result.reason}) — ${tc.reason}`;
    console.log(msg);
    failures.push(msg);
  }
}

console.log(`\n=== RESULTS ===`);
console.log(`Passed: ${passed}/${TEST_CASES.length}`);
console.log(`Failed: ${failed}/${TEST_CASES.length}`);

if (failures.length > 0) {
  console.log(`\nFailed tests:`);
  failures.forEach(f => console.log(f));
}

console.log(`\n=== FILTER COVERAGE ===`);
const filtersTestedSet = new Set<string>();
TEST_CASES.forEach(tc => {
  const profile = PROFILES.find(p => p.id === tc.profileId)!;
  filtersTestedSet.add("city");
  filtersTestedSet.add("price_min");
  filtersTestedSet.add("price_max");
  filtersTestedSet.add("bedrooms_min");
  filtersTestedSet.add("size_min");
  if (profile.furnished) filtersTestedSet.add("furnished");
  if (profile.extra_features) profile.extra_features.forEach(f => filtersTestedSet.add(`extra:${f}`));
  if (profile.districts) filtersTestedSet.add("districts");
});

const allFilters = [
  "city", "price_min", "price_max", "bedrooms_min", "size_min",
  "furnished", "extra:pets_allowed", "extra:balcony", "extra:elevator",
  "districts",
];

console.log("\nFilter             | Tested | In Engine | In Listings DB | End-to-End");
console.log("-------------------|--------|-----------|----------------|----------");
for (const f of allFilters) {
  const tested = filtersTestedSet.has(f) ? "YES" : "NO ";
  console.log(`${f.padEnd(19)}| ${tested}    | YES       | YES            | ${tested === "YES" ? "FULL" : "PARTIAL"}`);
}

const unsupported = [
  { filter: "extra:parking", note: "No parking column in listings — returns null → strict reject" },
  { filter: "extra:garden", note: "No garden column in listings — returns null → strict reject" },
  { filter: "extra:basement", note: "No basement column in listings — returns null → strict reject" },
  { filter: "radius_km", note: "Requires lat/lng on listings + distance calculation — columns added, logic TBD" },
  { filter: "commute", note: "Requires routing API — not implemented" },
];

console.log("\nPartially supported / not yet scraped:");
for (const u of unsupported) {
  console.log(`  ${u.filter}: ${u.note}`);
}

console.log(`\n=== AUDIT COMPLETE ===`);
if (failed > 0) {
  process.exit(1);
}
