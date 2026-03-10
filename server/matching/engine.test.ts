import { explainMatchInternal, type FilterCheck } from "./engine";

function makeListing(overrides: Partial<any> = {}): any {
  return {
    id: "test-listing",
    source: "test",
    url: "https://example.com",
    title: "Test Listing",
    city: "Berlin",
    price: 1000,
    bedrooms: 2,
    size_m2: 50,
    furnished: null,
    pets_allowed: null,
    balcony: null,
    elevator: null,
    district: null,
    ...overrides,
  };
}

function makeProfile(overrides: Partial<any> = {}): any {
  return {
    id: "test-profile",
    user_id: "test-user",
    city: "Berlin",
    price_min: 0,
    price_max: 1500,
    bedrooms_min: 1,
    size_min: 30,
    furnished: "any",
    extra_features: [],
    districts: [],
    location_mode: "city",
    ...overrides,
  };
}

function findCheck(checks: FilterCheck[], filter: string): FilterCheck | undefined {
  return checks.find(c => c.filter === filter || c.filter.startsWith(filter));
}

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}${detail ? " — " + detail : ""}`);
  }
}

console.log("=== STRICT FILTERS (unchanged) ===\n");

console.log("City filter:");
{
  const r = explainMatchInternal(makeListing({ city: "Berlin" }), makeProfile({ city: "Berlin" }));
  assert("Berlin matches Berlin", r.matched);
}
{
  const r = explainMatchInternal(makeListing({ city: "Hamburg" }), makeProfile({ city: "Berlin" }));
  assert("Hamburg does NOT match Berlin", !r.matched && r.reason!.includes("City"));
}

console.log("\nPrice filter:");
{
  const r = explainMatchInternal(makeListing({ price: 1500 }), makeProfile({ price_max: 1500 }));
  assert("€1500 matches max €1500", r.matched);
}
{
  const r = explainMatchInternal(makeListing({ price: 1501 }), makeProfile({ price_max: 1500 }));
  assert("€1501 rejected by max €1500", !r.matched && r.reason!.includes("Price"));
}

console.log("\nBedrooms filter:");
{
  const r = explainMatchInternal(makeListing({ bedrooms: 2 }), makeProfile({ bedrooms_min: 2 }));
  assert("2 bedrooms matches min 2", r.matched);
}
{
  const r = explainMatchInternal(makeListing({ bedrooms: 1 }), makeProfile({ bedrooms_min: 2 }));
  assert("1 bedroom rejected by min 2", !r.matched && r.reason!.includes("Bedrooms"));
}

console.log("\nSize filter:");
{
  const r = explainMatchInternal(makeListing({ size_m2: 30 }), makeProfile({ size_min: 30 }));
  assert("30m² matches min 30", r.matched);
}
{
  const r = explainMatchInternal(makeListing({ size_m2: 29 }), makeProfile({ size_min: 30 }));
  assert("29m² rejected by min 30", !r.matched && r.reason!.includes("Size"));
}

console.log("\n=== HYBRID: FURNISHED ===\n");

console.log("Profile requires furnished:");
{
  const r = explainMatchInternal(makeListing({ furnished: true }), makeProfile({ furnished: "furnished" }));
  const c = findCheck(r.checks, "furnished");
  assert("furnished=true → MATCH (true match)", r.matched && c?.passed === true && !c?.hybridPass);
}
{
  const r = explainMatchInternal(makeListing({ furnished: null }), makeProfile({ furnished: "furnished" }));
  const c = findCheck(r.checks, "furnished");
  assert("furnished=null → MATCH (hybrid pass)", r.matched && c?.passed === true && c?.hybridPass === true);
}
{
  const r = explainMatchInternal(makeListing({ furnished: false }), makeProfile({ furnished: "furnished" }));
  assert("furnished=false → REJECT", !r.matched && r.reason!.includes("Furnished"));
}

console.log("\nProfile requires unfurnished:");
{
  const r = explainMatchInternal(makeListing({ furnished: false }), makeProfile({ furnished: "unfurnished" }));
  const c = findCheck(r.checks, "furnished");
  assert("furnished=false → MATCH (true match)", r.matched && c?.passed === true && !c?.hybridPass);
}
{
  const r = explainMatchInternal(makeListing({ furnished: null }), makeProfile({ furnished: "unfurnished" }));
  const c = findCheck(r.checks, "furnished");
  assert("furnished=null → MATCH (hybrid pass)", r.matched && c?.passed === true && c?.hybridPass === true);
}
{
  const r = explainMatchInternal(makeListing({ furnished: true }), makeProfile({ furnished: "unfurnished" }));
  assert("furnished=true → REJECT", !r.matched && r.reason!.includes("Furnished"));
}

console.log("\n=== HYBRID: PETS_ALLOWED ===\n");

{
  const r = explainMatchInternal(makeListing({ pets_allowed: true }), makeProfile({ extra_features: ["pets_allowed"] }));
  const c = findCheck(r.checks, "extra_feature:pets_allowed");
  assert("pets=true → MATCH (true match)", r.matched && c?.passed === true && !c?.hybridPass);
}
{
  const r = explainMatchInternal(makeListing({ pets_allowed: null }), makeProfile({ extra_features: ["pets_allowed"] }));
  const c = findCheck(r.checks, "extra_feature:pets_allowed");
  assert("pets=null → MATCH (hybrid pass)", r.matched && c?.passed === true && c?.hybridPass === true);
}
{
  const r = explainMatchInternal(makeListing({ pets_allowed: false }), makeProfile({ extra_features: ["pets_allowed"] }));
  assert("pets=false → REJECT", !r.matched && r.reason!.includes("pets_allowed"));
}

console.log("\n=== HYBRID: DISTRICT ===\n");

{
  const r = explainMatchInternal(
    makeListing({ district: "Kreuzberg" }),
    makeProfile({ location_mode: "districts", districts: ["Kreuzberg"] })
  );
  const c = findCheck(r.checks, "district");
  assert("district=Kreuzberg matches [Kreuzberg] → MATCH (true match)", r.matched && c?.passed === true && !c?.hybridPass);
}
{
  const r = explainMatchInternal(
    makeListing({ district: null }),
    makeProfile({ location_mode: "districts", districts: ["Kreuzberg"] })
  );
  const c = findCheck(r.checks, "district");
  assert("district=null → MATCH (hybrid pass)", r.matched && c?.passed === true && c?.hybridPass === true);
}
{
  const r = explainMatchInternal(
    makeListing({ district: "" }),
    makeProfile({ location_mode: "districts", districts: ["Kreuzberg"] })
  );
  const c = findCheck(r.checks, "district");
  assert("district='' (empty) → MATCH (hybrid pass)", r.matched && c?.passed === true && c?.hybridPass === true);
}
{
  const r = explainMatchInternal(
    makeListing({ district: "Mitte" }),
    makeProfile({ location_mode: "districts", districts: ["Kreuzberg"] })
  );
  assert("district=Mitte NOT in [Kreuzberg] → REJECT", !r.matched && r.reason!.includes("Mitte"));
}

console.log("\n=== STRICT EXTRA FEATURES (balcony, elevator remain strict) ===\n");

{
  const r = explainMatchInternal(makeListing({ balcony: null }), makeProfile({ extra_features: ["balcony"] }));
  assert("balcony=null → REJECT (strict, not hybrid)", !r.matched && r.reason!.includes("balcony"));
}
{
  const r = explainMatchInternal(makeListing({ balcony: true }), makeProfile({ extra_features: ["balcony"] }));
  assert("balcony=true → MATCH (strict true match)", r.matched);
}
{
  const r = explainMatchInternal(makeListing({ balcony: false }), makeProfile({ extra_features: ["balcony"] }));
  assert("balcony=false → REJECT (strict)", !r.matched);
}
{
  const r = explainMatchInternal(makeListing({ elevator: null }), makeProfile({ extra_features: ["elevator"] }));
  assert("elevator=null → REJECT (strict, not hybrid)", !r.matched && r.reason!.includes("elevator"));
}

console.log("\n=== COMBINED HYBRID + STRICT ===\n");

{
  const r = explainMatchInternal(
    makeListing({ price: 2000, furnished: null, pets_allowed: null, district: null }),
    makeProfile({ price_max: 1500, furnished: "furnished", extra_features: ["pets_allowed"], location_mode: "districts", districts: ["Kreuzberg"] })
  );
  assert("Strict price rejection overrides hybrid passes", !r.matched && r.reason!.includes("Price"));
}
{
  const r = explainMatchInternal(
    makeListing({ price: 1000, furnished: null, pets_allowed: null, district: null }),
    makeProfile({ price_max: 1500, furnished: "furnished", extra_features: ["pets_allowed"], location_mode: "districts", districts: ["Kreuzberg"] })
  );
  const fc = findCheck(r.checks, "furnished");
  const pc = findCheck(r.checks, "extra_feature:pets_allowed");
  const dc = findCheck(r.checks, "district");
  assert("All hybrid filters null → all hybrid pass, match succeeds",
    r.matched && fc?.hybridPass === true && pc?.hybridPass === true && dc?.hybridPass === true
  );
}
{
  const r = explainMatchInternal(
    makeListing({ price: 1000, furnished: true, pets_allowed: null, district: "Kreuzberg" }),
    makeProfile({ price_max: 1500, furnished: "furnished", extra_features: ["pets_allowed"], location_mode: "districts", districts: ["Kreuzberg"] })
  );
  const fc = findCheck(r.checks, "furnished");
  const pc = findCheck(r.checks, "extra_feature:pets_allowed");
  const dc = findCheck(r.checks, "district");
  assert("Mix of true match + hybrid pass works",
    r.matched && fc?.hybridPass !== true && pc?.hybridPass === true && dc?.hybridPass !== true
  );
}

console.log(`\n${"=".repeat(50)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
if (failed > 0) {
  console.log("❌ SOME TESTS FAILED");
  process.exit(1);
} else {
  console.log("✅ ALL TESTS PASSED");
}
