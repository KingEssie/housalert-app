import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("FAIL: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_USER_ID = "00000000-0000-0000-0000-000000000099";
const TEST_PREFIX = "__test_match_engine__";
const TEST_CITY = "__TestStadt__";

async function cleanup() {
  console.log("[CLEANUP] Removing test data...");
  await supabase.from("matches").delete().eq("user_id", TEST_USER_ID);
  await supabase.from("search_profiles").delete().eq("user_id", TEST_USER_ID);
  await supabase.from("listings").delete().like("title", `${TEST_PREFIX}%`);
  console.log("[CLEANUP] Done");
}

async function run() {
  await cleanup();

  console.log("\n[TEST] Creating test search profile...");
  const { data: profile, error: pErr } = await supabase
    .from("search_profiles")
    .insert({
      user_id: TEST_USER_ID,
      city: TEST_CITY,
      price_min: 500,
      price_max: 1200,
      bedrooms_min: 1,
      size_min: 30,
    })
    .select("id")
    .single();

  if (pErr || !profile) {
    console.error("FAIL: Could not create test search profile:", pErr?.message);
    await cleanup();
    process.exit(1);
  }
  console.log(`  profile.id = ${profile.id}`);

  console.log("\n[TEST] Creating matching listing...");
  const { data: goodListing, error: glErr } = await supabase
    .from("listings")
    .insert({
      title: `${TEST_PREFIX}good_listing`,
      url: `https://test.example.com/${TEST_PREFIX}good`,
      city: TEST_CITY,
      price: 800,
      bedrooms: 2,
      size_m2: 50,
      source: "test",
      source_id: `${TEST_PREFIX}good`,
    })
    .select("id")
    .single();

  if (glErr || !goodListing) {
    console.error("FAIL: Could not create matching listing:", glErr?.message);
    await cleanup();
    process.exit(1);
  }
  console.log(`  goodListing.id = ${goodListing.id}`);

  console.log("\n[TEST] Creating non-matching listing (wrong city, wrong price, wrong size)...");
  const { data: badListing, error: blErr } = await supabase
    .from("listings")
    .insert({
      title: `${TEST_PREFIX}bad_listing`,
      url: `https://test.example.com/${TEST_PREFIX}bad`,
      city: "__NoMatchStadt__",
      price: 2000,
      bedrooms: 0,
      size_m2: 10,
      source: "test",
      source_id: `${TEST_PREFIX}bad`,
    })
    .select("id")
    .single();

  if (blErr || !badListing) {
    console.error("FAIL: Could not create non-matching listing:", blErr?.message);
    await cleanup();
    process.exit(1);
  }
  console.log(`  badListing.id = ${badListing.id}`);

  console.log("\n[TEST 1] matchListingAgainstProfiles for GOOD listing...");
  const { matchListingAgainstProfiles, backfillMatchesForSearchProfile } = await import("../server/matching/engine");
  const goodMatches = await matchListingAgainstProfiles(goodListing.id);
  console.log(`  matches created = ${goodMatches}`);

  console.log("\n[TEST 2] matchListingAgainstProfiles for BAD listing...");
  const badMatches = await matchListingAgainstProfiles(badListing.id);
  console.log(`  matches created = ${badMatches}`);

  console.log("\n[TEST 3] Verify matches in DB...");
  const { data: allMatches } = await supabase
    .from("matches")
    .select("id, listing_id")
    .eq("user_id", TEST_USER_ID);

  const goodMatchRows = (allMatches ?? []).filter((m: any) => m.listing_id === goodListing.id);
  const badMatchRows = (allMatches ?? []).filter((m: any) => m.listing_id === badListing.id);
  console.log(`  good listing matches: ${goodMatchRows.length}`);
  console.log(`  bad listing matches: ${badMatchRows.length}`);

  console.log("\n[TEST 4] Duplicate prevention...");
  const dupMatches = await matchListingAgainstProfiles(goodListing.id);
  console.log(`  duplicate matches: ${dupMatches}`);

  console.log("\n[TEST 5] Backfill for search profile...");
  await supabase.from("matches").delete().eq("user_id", TEST_USER_ID);
  const backfillCount = await backfillMatchesForSearchProfile(profile.id);
  console.log(`  backfill matches: ${backfillCount}`);

  let passed = true;

  if (goodMatchRows.length !== 1) {
    console.error(`FAIL: Expected 1 match for good listing, got ${goodMatchRows.length}`);
    passed = false;
  }
  if (badMatchRows.length !== 0) {
    console.error(`FAIL: Expected 0 matches for bad listing, got ${badMatchRows.length}`);
    passed = false;
  }
  if (dupMatches !== 0) {
    console.error(`FAIL: Expected 0 duplicate matches, got ${dupMatches}`);
    passed = false;
  }
  if (backfillCount < 1) {
    console.error(`FAIL: Expected >= 1 backfill match, got ${backfillCount}`);
    passed = false;
  }

  await cleanup();

  if (passed) {
    console.log("\n========================================");
    console.log("  ALL TESTS PASSED");
    console.log("========================================\n");
    process.exit(0);
  } else {
    console.log("\n========================================");
    console.log("  SOME TESTS FAILED");
    console.log("========================================\n");
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("FAIL: Unhandled error:", err);
  cleanup().finally(() => process.exit(1));
});
