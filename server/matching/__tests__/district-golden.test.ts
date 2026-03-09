import { explainMatchInternal } from "../engine";

const BASE_LISTING = {
  id: "L-BASE",
  source: "wg-gesucht",
  url: null,
  title: "Test Listing",
  city: "Berlin",
  price: 1000,
  bedrooms: 2,
  size_m2: 50,
};

const BASE_PROFILE = {
  id: "P-BASE",
  user_id: "u1",
  city: "Berlin",
  price_min: 0,
  price_max: 2000,
  bedrooms_min: 1,
  size_min: 30,
};

interface GoldenCase {
  name: string;
  listing: { district: string | null };
  profile: { districts: string[] | null | undefined; location_mode?: string | null };
  expected: boolean;
  reason: string;
}

const GOLDEN_CASES: GoldenCase[] = [
  {
    name: "district=Kreuzberg, profile=[Kreuzberg] → MATCH",
    listing: { district: "Kreuzberg" },
    profile: { districts: ["Kreuzberg"] },
    expected: true,
    reason: "Exact match on selected district",
  },
  {
    name: "district=Kreuzberg, profile=[Kreuzberg, Mitte] → MATCH",
    listing: { district: "Kreuzberg" },
    profile: { districts: ["Kreuzberg", "Mitte"] },
    expected: true,
    reason: "Matches one of the selected districts",
  },
  {
    name: "district=Mitte, profile=[Kreuzberg, Mitte, Friedrichshain] → MATCH",
    listing: { district: "Mitte" },
    profile: { districts: ["Kreuzberg", "Mitte", "Friedrichshain"] },
    expected: true,
    reason: "Matches second of three selected districts",
  },
  {
    name: "district=Neukölln, profile=[Kreuzberg, Mitte] → REJECT",
    listing: { district: "Neukölln" },
    profile: { districts: ["Kreuzberg", "Mitte"] },
    expected: false,
    reason: "District not in profile selection",
  },
  {
    name: "district=null, profile=[Kreuzberg] → REJECT (strict)",
    listing: { district: null },
    profile: { districts: ["Kreuzberg"] },
    expected: false,
    reason: "Unknown district rejected when filter active",
  },
  {
    name: "district=Kreuzberg, profile=null → MATCH (filter inactive)",
    listing: { district: "Kreuzberg" },
    profile: { districts: null },
    expected: true,
    reason: "No district filter set — all districts pass",
  },
  {
    name: "district=null, profile=null → MATCH (filter inactive)",
    listing: { district: null },
    profile: { districts: null },
    expected: true,
    reason: "No district filter, no listing district — passes",
  },
  {
    name: "district=Kreuzberg, profile=[] → MATCH (empty array = inactive)",
    listing: { district: "Kreuzberg" },
    profile: { districts: [] },
    expected: true,
    reason: "Empty array means no filter active",
  },
  {
    name: "district=null, profile=[] → MATCH (empty array = inactive)",
    listing: { district: null },
    profile: { districts: [] },
    expected: true,
    reason: "Empty array means no filter active",
  },
  {
    name: "district=Kreuzberg, profile=undefined → MATCH",
    listing: { district: "Kreuzberg" },
    profile: { districts: undefined },
    expected: true,
    reason: "Undefined districts means no filter active",
  },
  {
    name: "case-insensitive: district=kreuzberg, profile=[Kreuzberg] → MATCH",
    listing: { district: "kreuzberg" },
    profile: { districts: ["Kreuzberg"] },
    expected: true,
    reason: "Case-insensitive comparison",
  },
  {
    name: "case-insensitive: district=KREUZBERG, profile=[kreuzberg] → MATCH",
    listing: { district: "KREUZBERG" },
    profile: { districts: ["kreuzberg"] },
    expected: true,
    reason: "Case-insensitive both directions",
  },
  {
    name: "substring: district=Berlin-Kreuzberg, profile=[Kreuzberg] → MATCH",
    listing: { district: "Berlin-Kreuzberg" },
    profile: { districts: ["Kreuzberg"] },
    expected: true,
    reason: "Substring match — listing district contains profile district",
  },
  {
    name: "substring: district=Prenzlauer Berg, profile=[Prenzlauer Berg] → MATCH",
    listing: { district: "Prenzlauer Berg" },
    profile: { districts: ["Prenzlauer Berg"] },
    expected: true,
    reason: "Multi-word district exact match",
  },
  {
    name: "whitespace: district= Kreuzberg , profile=[Kreuzberg] → MATCH",
    listing: { district: " Kreuzberg " },
    profile: { districts: ["Kreuzberg"] },
    expected: true,
    reason: "Leading/trailing whitespace is trimmed during comparison",
  },
  {
    name: "empty string: district='', profile=[Kreuzberg] → REJECT",
    listing: { district: "" },
    profile: { districts: ["Kreuzberg"] },
    expected: false,
    reason: "Empty string treated as no district — rejected",
  },
  {
    name: "many districts: district=Schöneberg, profile=[Mitte,Kreuzberg,Wedding,Moabit,Schöneberg] → MATCH",
    listing: { district: "Schöneberg" },
    profile: { districts: ["Mitte", "Kreuzberg", "Wedding", "Moabit", "Schöneberg"] },
    expected: true,
    reason: "Matches the last of five selected districts",
  },
  {
    name: "close but no match: district=Friedrichshagen, profile=[Friedrichshain] → REJECT",
    listing: { district: "Friedrichshagen" },
    profile: { districts: ["Friedrichshain"] },
    expected: false,
    reason: "Similar names but no substring match",
  },
  {
    name: "location_mode=districts: district=Kreuzberg, profile=[Kreuzberg] → MATCH",
    listing: { district: "Kreuzberg" },
    profile: { districts: ["Kreuzberg"], location_mode: "districts" },
    expected: true,
    reason: "Explicit districts mode — filter active and matches",
  },
  {
    name: "location_mode=radius with stale districts → MATCH (filter skipped)",
    listing: { district: "Neukölln" },
    profile: { districts: ["Kreuzberg"], location_mode: "radius" },
    expected: true,
    reason: "Radius mode — district filter must be skipped even if profile has stale districts",
  },
  {
    name: "location_mode=commute with stale districts → MATCH (filter skipped)",
    listing: { district: null },
    profile: { districts: ["Mitte"], location_mode: "commute" },
    expected: true,
    reason: "Commute mode — district filter must be skipped",
  },
  {
    name: "location_mode=city with stale districts → MATCH (filter skipped)",
    listing: { district: "Wedding" },
    profile: { districts: ["Kreuzberg"], location_mode: "city" },
    expected: true,
    reason: "City mode — district filter must be skipped even if districts array populated",
  },
  {
    name: "location_mode=null (legacy), districts set → filter active",
    listing: { district: null },
    profile: { districts: ["Kreuzberg"], location_mode: null },
    expected: false,
    reason: "Legacy profile without location_mode — district filter applies for backward compat",
  },
  {
    name: "location_mode=undefined (legacy), districts set → filter active",
    listing: { district: "Kreuzberg" },
    profile: { districts: ["Kreuzberg"], location_mode: undefined },
    expected: true,
    reason: "Legacy profile without location_mode — district filter applies and matches",
  },
];

console.log("\n=== DISTRICT GOLDEN TEST SET ===\n");

let passed = 0;
let failed = 0;
const failures: string[] = [];

for (const tc of GOLDEN_CASES) {
  const listing = { ...BASE_LISTING, ...tc.listing } as any;
  const profile = { ...BASE_PROFILE, ...tc.profile } as any;
  const result = explainMatchInternal(listing, profile);

  if (result.matched === tc.expected) {
    passed++;
    console.log(`  ✓ ${tc.name}`);
  } else {
    failed++;
    const msg = `  ✗ ${tc.name}: expected=${tc.expected}, got=${result.matched} (engine: ${result.reason})`;
    console.log(msg);
    failures.push(msg);
  }
}

console.log(`\n=== RESULTS: ${passed}/${GOLDEN_CASES.length} passed ===`);
if (failures.length > 0) {
  console.log("\nFailed tests:");
  failures.forEach(f => console.log(f));
}

console.log("\n=== DISTRICT NORMALIZATION VERIFICATION ===");
function normalizeDistrict(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

const normCases = [
  { input: "Kreuzberg", expected: "Kreuzberg" },
  { input: " Kreuzberg ", expected: "Kreuzberg" },
  { input: "Prenzlauer  Berg", expected: "Prenzlauer Berg" },
  { input: "  St.  Pauli  ", expected: "St. Pauli" },
  { input: "Hamburg-Mitte", expected: "Hamburg-Mitte" },
  { input: "Köln Ehrenfeld", expected: "Köln Ehrenfeld" },
];
let normPassed = 0;
for (const nc of normCases) {
  const result = normalizeDistrict(nc.input);
  const ok = result === nc.expected;
  normPassed += ok ? 1 : 0;
  console.log(`  ${ok ? "✓" : "✗"} "${nc.input}" → "${result}" (expected "${nc.expected}")`);
}
console.log(`\nNormalization: ${normPassed}/${normCases.length} passed`);

if (failed > 0) {
  process.exit(1);
}
