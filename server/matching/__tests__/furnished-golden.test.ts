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
  listing: { furnished: boolean | null };
  profile: { furnished: string | null | undefined };
  expected: boolean;
  reason: string;
}

const GOLDEN_CASES: GoldenCase[] = [
  {
    name: "furnished=true, profile=furnished → MATCH",
    listing: { furnished: true },
    profile: { furnished: "furnished" },
    expected: true,
    reason: "Listing is furnished, profile requires furnished",
  },
  {
    name: "furnished=false, profile=furnished → REJECT",
    listing: { furnished: false },
    profile: { furnished: "furnished" },
    expected: false,
    reason: "Listing is not furnished, profile requires furnished",
  },
  {
    name: "furnished=null, profile=furnished → REJECT (strict)",
    listing: { furnished: null },
    profile: { furnished: "furnished" },
    expected: false,
    reason: "Listing furnished unknown, strict filter rejects",
  },
  {
    name: "furnished=undefined, profile=furnished → REJECT (strict)",
    listing: { furnished: undefined as any },
    profile: { furnished: "furnished" },
    expected: false,
    reason: "Listing furnished missing, strict filter rejects",
  },
  {
    name: "furnished=true, profile=unfurnished → REJECT",
    listing: { furnished: true },
    profile: { furnished: "unfurnished" },
    expected: false,
    reason: "Listing is furnished but profile wants unfurnished",
  },
  {
    name: "furnished=false, profile=unfurnished → MATCH",
    listing: { furnished: false },
    profile: { furnished: "unfurnished" },
    expected: true,
    reason: "Listing is unfurnished, profile wants unfurnished",
  },
  {
    name: "furnished=null, profile=unfurnished → REJECT (strict)",
    listing: { furnished: null },
    profile: { furnished: "unfurnished" },
    expected: false,
    reason: "Listing furnished unknown, strict filter rejects unfurnished too",
  },
  {
    name: "furnished=true, profile=any → MATCH",
    listing: { furnished: true },
    profile: { furnished: "any" },
    expected: true,
    reason: "Profile has no furnished preference",
  },
  {
    name: "furnished=false, profile=any → MATCH",
    listing: { furnished: false },
    profile: { furnished: "any" },
    expected: true,
    reason: "Profile has no furnished preference",
  },
  {
    name: "furnished=null, profile=any → MATCH",
    listing: { furnished: null },
    profile: { furnished: "any" },
    expected: true,
    reason: "Profile has no furnished preference",
  },
  {
    name: "furnished=true, profile=no_preference → MATCH",
    listing: { furnished: true },
    profile: { furnished: "no_preference" },
    expected: true,
    reason: "no_preference treated same as any",
  },
  {
    name: "furnished=true, profile=null → MATCH",
    listing: { furnished: true },
    profile: { furnished: null },
    expected: true,
    reason: "Profile furnished is null — filter not active",
  },
  {
    name: "furnished=true, profile=undefined → MATCH",
    listing: { furnished: true },
    profile: { furnished: undefined },
    expected: true,
    reason: "Profile furnished is undefined — filter not active",
  },
  {
    name: "furnished=true, profile='' → MATCH",
    listing: { furnished: true },
    profile: { furnished: "" },
    expected: true,
    reason: "Profile furnished is empty string — filter not active",
  },
  {
    name: "furnished=null, profile=null → MATCH",
    listing: { furnished: null },
    profile: { furnished: null },
    expected: true,
    reason: "Neither side has a value — filter skipped",
  },
];

console.log("\n=== FURNISHED GOLDEN TEST SET ===\n");

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

console.log("\n=== NORMALIZATION VERIFICATION ===");
const UNFURNISHED_PATTERNS = /unmöbliert|unfurnished|nicht\s*möbliert/i;
const FURNISHED_PATTERNS = /möbliert|furnished|teilmöbliert|voll\s*möbliert/i;

function parseFurnished(text: string): boolean | null {
  if (UNFURNISHED_PATTERNS.test(text)) return false;
  if (FURNISHED_PATTERNS.test(text)) return true;
  return null;
}

const normCases: Array<{ input: string; expected: boolean | null }> = [
  { input: "möbliert", expected: true },
  { input: "Möbliert", expected: true },
  { input: "furnished", expected: true },
  { input: "Furnished", expected: true },
  { input: "teilmöbliert", expected: true },
  { input: "Teilmöbliert", expected: true },
  { input: "voll möbliert", expected: true },
  { input: "Voll Möbliert", expected: true },
  { input: "voll  möbliert", expected: true },
  { input: "unmöbliert", expected: false },
  { input: "Unmöbliert", expected: false },
  { input: "unfurnished", expected: false },
  { input: "Unfurnished", expected: false },
  { input: "nicht möbliert", expected: false },
  { input: "Nicht Möbliert", expected: false },
  { input: "nicht  möbliert", expected: false },
  { input: "2 Zimmer Wohnung", expected: null },
  { input: "Neubau Apartment", expected: null },
];
let normPassed = 0;
for (const nc of normCases) {
  const result = parseFurnished(nc.input);
  const ok = result === nc.expected;
  normPassed += ok ? 1 : 0;
  console.log(`  ${ok ? "✓" : "✗"} "${nc.input}" → ${result} (expected ${nc.expected})`);
}
console.log(`\nNormalization: ${normPassed}/${normCases.length} passed`);

if (failed > 0) {
  process.exit(1);
}
