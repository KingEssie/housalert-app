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
  listing: { pets_allowed: boolean | null | undefined };
  profile: { extra_features: string[] | null | undefined };
  expected: boolean;
  reason: string;
}

const GOLDEN_CASES: GoldenCase[] = [
  {
    name: "pets_allowed=true, profile=[huisdieren] → MATCH",
    listing: { pets_allowed: true },
    profile: { extra_features: ["huisdieren"] },
    expected: true,
    reason: "Listing allows pets, profile requires pets via Dutch label",
  },
  {
    name: "pets_allowed=false, profile=[huisdieren] → REJECT",
    listing: { pets_allowed: false },
    profile: { extra_features: ["huisdieren"] },
    expected: false,
    reason: "Listing explicitly disallows pets, profile requires pets",
  },
  {
    name: "pets_allowed=null, profile=[huisdieren] → REJECT (strict)",
    listing: { pets_allowed: null },
    profile: { extra_features: ["huisdieren"] },
    expected: false,
    reason: "Unknown pet policy — strict null rejection when filter active",
  },
  {
    name: "pets_allowed=undefined, profile=[huisdieren] → REJECT (strict)",
    listing: { pets_allowed: undefined },
    profile: { extra_features: ["huisdieren"] },
    expected: false,
    reason: "Missing pet field — strict null rejection when filter active",
  },
  {
    name: "pets_allowed=true, profile=[pets_allowed] → MATCH (English key)",
    listing: { pets_allowed: true },
    profile: { extra_features: ["pets_allowed"] },
    expected: true,
    reason: "English key must also resolve correctly",
  },
  {
    name: "pets_allowed=false, profile=[pets_allowed] → REJECT (English key)",
    listing: { pets_allowed: false },
    profile: { extra_features: ["pets_allowed"] },
    expected: false,
    reason: "English key — listing disallows pets",
  },
  {
    name: "pets_allowed=null, profile=[pets_allowed] → REJECT (English key)",
    listing: { pets_allowed: null },
    profile: { extra_features: ["pets_allowed"] },
    expected: false,
    reason: "English key — null = strict reject",
  },
  {
    name: "pets_allowed=true, profile=null → MATCH (no filter)",
    listing: { pets_allowed: true },
    profile: { extra_features: null },
    expected: true,
    reason: "No extra features selected — filter inactive",
  },
  {
    name: "pets_allowed=false, profile=[] → MATCH (empty array = no filter)",
    listing: { pets_allowed: false },
    profile: { extra_features: [] },
    expected: true,
    reason: "Empty extra_features array — filter inactive",
  },
  {
    name: "pets_allowed=null, profile=undefined → MATCH (no filter)",
    listing: { pets_allowed: null },
    profile: { extra_features: undefined },
    expected: true,
    reason: "Undefined extra_features — filter inactive",
  },
  {
    name: "pets_allowed=true, profile=[huisdieren, balkon] → REJECT (balcony null)",
    listing: { pets_allowed: true },
    profile: { extra_features: ["huisdieren", "balkon"] },
    expected: false,
    reason: "Pets allowed but balcony not on listing (balcony=null → strict reject on second feature)",
  },
  {
    name: "pets_allowed=true, profile=[lift] → REJECT (elevator null)",
    listing: { pets_allowed: true },
    profile: { extra_features: ["lift"] },
    expected: false,
    reason: "Profile only requires elevator, pets not in filter — elevator=null → reject",
  },
];

console.log("\n=== PETS_ALLOWED GOLDEN TEST SET ===\n");

let passed = 0;
let failed = 0;

for (const tc of GOLDEN_CASES) {
  const listing = { ...BASE_LISTING, ...tc.listing } as any;
  const profile = { ...BASE_PROFILE, ...tc.profile } as any;
  const result = explainMatchInternal(listing, profile);
  const ok = result.matched === tc.expected;
  if (ok) {
    passed++;
    console.log(`  ✓ ${tc.name}`);
  } else {
    failed++;
    console.log(`  ✗ ${tc.name}`);
    console.log(`    Expected: ${tc.expected}, Got: ${result.matched}`);
    console.log(`    Reason: ${tc.reason}`);
    console.log(`    Engine: ${result.reason}`);
    console.log(`    Checks: ${JSON.stringify(result.checks.filter(c => !c.passed), null, 2)}`);
  }
}

console.log(`\n=== RESULTS: ${passed}/${passed + failed} passed ===\n`);

console.log("=== PETS NORMALIZATION VERIFICATION ===");

const NO_PETS_PATTERNS = /keine\s*haustiere|keine\s*tiere|no\s*pets|haustiere\s*nicht\s*erlaubt|tiere\s*nicht\s*erlaubt/i;
const PETS_PATTERNS = /haustier|pet|tiere?\s*erlaubt/i;

function parsePets(text: string): boolean | null {
  if (NO_PETS_PATTERNS.test(text)) return false;
  if (PETS_PATTERNS.test(text)) return true;
  return null;
}

const NORM_CASES: { input: string; expected: boolean | null }[] = [
  { input: "Haustiere erlaubt", expected: true },
  { input: "haustiere erlaubt", expected: true },
  { input: "Haustier", expected: true },
  { input: "pets allowed", expected: true },
  { input: "Pets Allowed", expected: true },
  { input: "pet friendly", expected: true },
  { input: "Tiere erlaubt", expected: true },
  { input: "tiere erlaubt", expected: true },
  { input: "Tier erlaubt", expected: true },
  { input: "keine Haustiere", expected: false },
  { input: "Keine Haustiere", expected: false },
  { input: "keine Tiere", expected: false },
  { input: "no pets", expected: false },
  { input: "No Pets", expected: false },
  { input: "Haustiere nicht erlaubt", expected: false },
  { input: "Tiere nicht erlaubt", expected: false },
  { input: "2 Zimmer Wohnung", expected: null },
  { input: "Neubau Apartment", expected: null },
  { input: "Parkplatz vorhanden", expected: null },
];

let normPassed = 0;
for (const nc of NORM_CASES) {
  const result = parsePets(nc.input);
  const ok = result === nc.expected;
  if (ok) {
    normPassed++;
    console.log(`  ✓ "${nc.input}" → ${result} (expected ${nc.expected})`);
  } else {
    console.log(`  ✗ "${nc.input}" → ${result} (expected ${nc.expected})`);
  }
}
console.log(`\nNormalization: ${normPassed}/${NORM_CASES.length} passed`);

if (failed > 0 || normPassed < NORM_CASES.length) {
  process.exit(1);
}
