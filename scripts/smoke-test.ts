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

const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";
const TEST_PREFIX = "__smoke_test__";

interface SearchProfile {
  id: string;
  city: string;
  price_min: number;
  price_max: number;
  bedrooms_min: number;
  size_min: number;
}

interface Listing {
  id: string;
  city: string;
  price: number;
  bedrooms: number;
  size_m2: number;
}

function doesMatch(listing: Listing, profile: SearchProfile): boolean {
  const lCity = listing.city.toLowerCase().trim();
  const pCity = profile.city.toLowerCase().trim();
  if (!lCity.includes(pCity) && !pCity.includes(lCity)) return false;
  if (profile.price_min > 0 && listing.price < profile.price_min) return false;
  if (profile.price_max > 0 && listing.price > profile.price_max) return false;
  if (profile.bedrooms_min > 0 && listing.bedrooms < profile.bedrooms_min) return false;
  if (profile.size_min > 0 && listing.size_m2 < profile.size_min) return false;
  return true;
}

const createdIds: { profiles: string[]; listings: string[]; matches: string[] } = {
  profiles: [],
  listings: [],
  matches: [],
};

async function cleanup() {
  if (createdIds.matches.length) {
    await supabase.from("matches").delete().in("id", createdIds.matches);
  }
  if (createdIds.listings.length) {
    await supabase.from("listings").delete().in("id", createdIds.listings);
  }
  if (createdIds.profiles.length) {
    await supabase.from("search_profiles").delete().in("id", createdIds.profiles);
  }
}

async function run() {
  console.log("Smoke test starting...\n");

  const { data: profile, error: profileErr } = await supabase
    .from("search_profiles")
    .insert({
      user_id: TEST_USER_ID,
      city: `${TEST_PREFIX}Berlin`,
      price_min: 500,
      price_max: 2000,
      bedrooms_min: 1,
      size_min: 30,
    })
    .select()
    .single();

  if (profileErr || !profile) {
    console.error("FAIL: Could not create test search profile:", profileErr?.message);
    return false;
  }
  createdIds.profiles.push(profile.id);
  console.log(`  Created search profile: ${profile.city} (${profile.id})`);

  const { data: goodListing, error: goodErr } = await supabase
    .from("listings")
    .insert({
      source: "smoke_test",
      title: `${TEST_PREFIX}Matching Apartment`,
      city: `${TEST_PREFIX}Berlin`,
      price: 1200,
      bedrooms: 2,
      size_m2: 50,
    })
    .select()
    .single();

  if (goodErr || !goodListing) {
    console.error("FAIL: Could not create matching listing:", goodErr?.message);
    return false;
  }
  createdIds.listings.push(goodListing.id);
  console.log(`  Created matching listing: ${goodListing.title} (${goodListing.id})`);

  const { data: badListing, error: badErr } = await supabase
    .from("listings")
    .insert({
      source: "smoke_test",
      title: `${TEST_PREFIX}Non-Matching Apartment`,
      city: `${TEST_PREFIX}Hamburg`,
      price: 2500,
      bedrooms: 1,
      size_m2: 20,
    })
    .select()
    .single();

  if (badErr || !badListing) {
    console.error("FAIL: Could not create non-matching listing:", badErr?.message);
    return false;
  }
  createdIds.listings.push(badListing.id);
  console.log(`  Created non-matching listing: ${badListing.title} (${badListing.id})`);

  const profiles: SearchProfile[] = [profile];
  const goodShouldMatch = doesMatch(goodListing as Listing, profile as SearchProfile);
  const badShouldMatch = doesMatch(badListing as Listing, profile as SearchProfile);

  console.log(`\n  Matching logic check:`);
  console.log(`    Good listing matches profile: ${goodShouldMatch}`);
  console.log(`    Bad listing matches profile:  ${badShouldMatch}`);

  if (!goodShouldMatch) {
    console.error("FAIL: Good listing should match but doesMatch returned false");
    return false;
  }
  if (badShouldMatch) {
    console.error("FAIL: Bad listing should NOT match but doesMatch returned true");
    return false;
  }

  const { data: matchRow, error: matchErr } = await supabase
    .from("matches")
    .insert({
      user_id: TEST_USER_ID,
      search_profile_id: profile.id,
      listing_id: goodListing.id,
    })
    .select()
    .single();

  if (matchErr || !matchRow) {
    console.error("FAIL: Could not insert match row:", matchErr?.message);
    return false;
  }
  createdIds.matches.push(matchRow.id);
  console.log(`  Inserted match for good listing (${matchRow.id})`);

  const { data: matchesForUser, error: fetchErr } = await supabase
    .from("matches")
    .select("id")
    .eq("user_id", TEST_USER_ID)
    .eq("search_profile_id", profile.id)
    .eq("listing_id", goodListing.id);

  if (fetchErr) {
    console.error("FAIL: Could not query matches:", fetchErr.message);
    return false;
  }

  if (!matchesForUser || matchesForUser.length !== 1) {
    console.error(`FAIL: Expected 1 match for good listing, got ${matchesForUser?.length ?? 0}`);
    return false;
  }

  const { data: badMatches } = await supabase
    .from("matches")
    .select("id")
    .eq("user_id", TEST_USER_ID)
    .eq("search_profile_id", profile.id)
    .eq("listing_id", badListing.id);

  if (badMatches && badMatches.length > 0) {
    console.error(`FAIL: Expected 0 matches for bad listing, got ${badMatches.length}`);
    return false;
  }

  console.log(`\n  Assertions passed:`);
  console.log(`    1 match for matching listing`);
  console.log(`    0 matches for non-matching listing`);

  return true;
}

run()
  .then(async (passed) => {
    await cleanup();
    console.log("");
    if (passed) {
      console.log("PASS");
      process.exit(0);
    } else {
      console.log("FAIL");
      process.exit(1);
    }
  })
  .catch(async (err) => {
    console.error("FAIL: Unexpected error:", err);
    await cleanup();
    process.exit(1);
  });
