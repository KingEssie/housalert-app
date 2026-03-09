import { createClient } from "@supabase/supabase-js";
import { sendMatchAlerts } from "../notifications";
import { trackMatchCreated } from "../freshness";

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface SearchProfile {
  id: string;
  user_id: string;
  city: string;
  city_name?: string;
  price_min: number;
  price_max: number;
  bedrooms_min: number;
  size_min: number;
}

interface DbListing {
  id: string;
  source: string;
  url: string | null;
  title: string;
  city: string;
  price: number;
  bedrooms: number;
  size_m2: number;
}

export interface FilterCheck {
  filter: string;
  profileField: string;
  profileValue: string;
  listingField: string;
  listingValue: string;
  rule: string;
  passed: boolean;
}

export interface MatchExplanation {
  matched: boolean;
  checks: FilterCheck[];
  reason: string;
}

function explainMatchInternal(listing: DbListing, profile: SearchProfile): MatchExplanation {
  const checks: FilterCheck[] = [];
  const listingCity = listing.city.toLowerCase().trim();
  const profileCity = (profile.city_name || profile.city || "").toLowerCase().trim();

  const cityPassed = !!profileCity && (listingCity.includes(profileCity) || profileCity.includes(listingCity));
  checks.push({
    filter: "city",
    profileField: "city_name || city",
    profileValue: profileCity || "(empty)",
    listingField: "city",
    listingValue: listingCity,
    rule: "substring match (case-insensitive)",
    passed: cityPassed,
  });
  if (!cityPassed) return { matched: false, checks, reason: `City mismatch: listing="${listingCity}" vs profile="${profileCity}"` };

  const priceMinPassed = !(profile.price_min > 0 && listing.price < profile.price_min);
  checks.push({
    filter: "price_min",
    profileField: "price_min",
    profileValue: String(profile.price_min),
    listingField: "price",
    listingValue: String(listing.price),
    rule: "listing.price >= profile.price_min (skipped if price_min=0)",
    passed: priceMinPassed,
  });
  if (!priceMinPassed) return { matched: false, checks, reason: `Price ${listing.price} < min ${profile.price_min}` };

  const priceMaxPassed = !(profile.price_max > 0 && listing.price > profile.price_max);
  checks.push({
    filter: "price_max",
    profileField: "price_max",
    profileValue: String(profile.price_max),
    listingField: "price",
    listingValue: String(listing.price),
    rule: "listing.price <= profile.price_max (skipped if price_max=0)",
    passed: priceMaxPassed,
  });
  if (!priceMaxPassed) return { matched: false, checks, reason: `Price ${listing.price} > max ${profile.price_max}` };

  const bedroomsPassed = !(profile.bedrooms_min > 0 && listing.bedrooms < profile.bedrooms_min);
  checks.push({
    filter: "bedrooms_min",
    profileField: "bedrooms_min",
    profileValue: String(profile.bedrooms_min),
    listingField: "bedrooms",
    listingValue: String(listing.bedrooms),
    rule: "listing.bedrooms >= profile.bedrooms_min (skipped if bedrooms_min=0)",
    passed: bedroomsPassed,
  });
  if (!bedroomsPassed) return { matched: false, checks, reason: `Bedrooms ${listing.bedrooms} < min ${profile.bedrooms_min}` };

  const sizePassed = !(profile.size_min > 0 && listing.size_m2 < profile.size_min);
  checks.push({
    filter: "size_min",
    profileField: "size_min",
    profileValue: String(profile.size_min),
    listingField: "size_m2",
    listingValue: String(listing.size_m2),
    rule: "listing.size_m2 >= profile.size_min (skipped if size_min=0)",
    passed: sizePassed,
  });
  if (!sizePassed) return { matched: false, checks, reason: `Size ${listing.size_m2}m² < min ${profile.size_min}m²` };

  return { matched: true, checks, reason: "All active filters passed" };
}

function doesListingMatchProfile(listing: DbListing, profile: SearchProfile): boolean {
  return explainMatchInternal(listing, profile).matched;
}

export async function explainMatch(
  listingId: string,
  profileId: string
): Promise<MatchExplanation & { listing?: DbListing; profile?: SearchProfile }> {
  const { data: listing } = await supabase
    .from("listings")
    .select("id, source, url, title, city, price, bedrooms, size_m2")
    .eq("id", listingId)
    .single();

  const { data: profile } = await supabase
    .from("search_profiles")
    .select("*")
    .eq("id", profileId)
    .single();

  if (!listing || !profile) {
    return {
      matched: false,
      checks: [],
      reason: !listing ? "Listing not found" : "Profile not found",
    };
  }

  const explanation = explainMatchInternal(listing as DbListing, profile as SearchProfile);
  return {
    ...explanation,
    listing: listing as DbListing,
    profile: profile as SearchProfile,
  };
}

export async function explainAllProfilesForListing(
  listingId: string
): Promise<{ listing: DbListing | null; results: Array<{ profileId: string; city: string; matched: boolean; reason: string; checks: FilterCheck[] }> }> {
  const { data: listing } = await supabase
    .from("listings")
    .select("id, source, url, title, city, price, bedrooms, size_m2")
    .eq("id", listingId)
    .single();

  if (!listing) return { listing: null, results: [] };

  const { data: profiles } = await supabase.from("search_profiles").select("*");
  if (!profiles) return { listing: listing as DbListing, results: [] };

  const results = profiles.map((p: any) => {
    const sp = p as SearchProfile;
    const explanation = explainMatchInternal(listing as DbListing, sp);
    return {
      profileId: sp.id,
      city: sp.city_name || sp.city,
      matched: explanation.matched,
      reason: explanation.reason,
      checks: explanation.checks,
    };
  });

  return { listing: listing as DbListing, results };
}

function log(msg: string) {
  const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
  console.log(`${ts} [match-engine] ${msg}`);
}

async function insertMatchIfNew(
  userId: string,
  searchProfileId: string,
  listingId: string
): Promise<boolean> {
  const { data: existing } = await supabase
    .from("matches")
    .select("id")
    .eq("user_id", userId)
    .eq("search_profile_id", searchProfileId)
    .eq("listing_id", listingId)
    .maybeSingle();

  if (existing) {
    log(`[MATCH SKIPPED DUPLICATE] user=${userId} profile=${searchProfileId} listing=${listingId}`);
    return false;
  }

  const { data: matchRow, error: mErr } = await supabase
    .from("matches")
    .insert({
      user_id: userId,
      search_profile_id: searchProfileId,
      listing_id: listingId,
    })
    .select("id")
    .single();

  if (mErr) {
    if (mErr.code === "23505") {
      log(`[MATCH SKIPPED DUPLICATE] user=${userId} profile=${searchProfileId} listing=${listingId}`);
      return false;
    }
    log(`[MATCH ERROR] ${mErr.message}`);
    return false;
  }

  log(`[MATCH CREATED] id=${matchRow.id} user=${userId} profile=${searchProfileId} listing=${listingId}`);
  trackMatchCreated(matchRow.id).catch(() => {});
  return true;
}

export async function matchListingAgainstProfiles(listingId: string): Promise<number> {
  log(`[MATCH ENGINE START] matchListingAgainstProfiles listing=${listingId}`);

  const { data: listing, error: lErr } = await supabase
    .from("listings")
    .select("id, source, url, title, city, price, bedrooms, size_m2")
    .eq("id", listingId)
    .single();

  if (lErr || !listing) {
    log(`[MATCH ENGINE COMPLETE] listing not found, 0 matches`);
    return 0;
  }

  const listingCity = (listing as DbListing).city.toLowerCase().trim();
  const safeCity = listingCity.replace(/[%_\\,()]/g, "");
  let profiles: any[] | null = null;
  let pErr: any = null;

  if (safeCity.length >= 3) {
    const result = await supabase
      .from("search_profiles")
      .select("*")
      .ilike("city", `%${safeCity}%`);
    profiles = result.data;
    pErr = result.error;
    if (pErr) {
      log(`[MATCH ENGINE] City-filtered query failed, falling back to full scan: ${pErr.message}`);
      const fallback = await supabase.from("search_profiles").select("*");
      profiles = fallback.data;
      pErr = fallback.error;
    }
  } else {
    const result = await supabase.from("search_profiles").select("*");
    profiles = result.data;
    pErr = result.error;
  }

  if (pErr || !profiles || profiles.length === 0) {
    log(`[MATCH ENGINE COMPLETE] no profiles found for city="${listingCity}", 0 matches`);
    return 0;
  }

  let totalMatches = 0;
  const alertedUsers = new Set<string>();

  for (const profile of profiles as SearchProfile[]) {
    if (!doesListingMatchProfile(listing as DbListing, profile)) continue;

    const created = await insertMatchIfNew(profile.user_id, profile.id, listing.id);
    if (!created) continue;

    totalMatches++;

    if (!alertedUsers.has(profile.user_id)) {
      alertedUsers.add(profile.user_id);
      const { data: userData } = await supabase.auth.admin.getUserById(profile.user_id);
      const email = userData?.user?.email;
      sendMatchAlerts(profile.user_id, email ?? undefined, listing as DbListing, supabase).catch((err) => {
        log(`[ALERT ERROR] Failed to send alerts for user=${profile.user_id}: ${err?.message ?? err}`);
      });
    }
  }

  log(`[MATCH ENGINE COMPLETE] listing=${listingId} matches=${totalMatches}`);
  return totalMatches;
}

export async function backfillMatchesForSearchProfile(searchProfileId: string): Promise<number> {
  log(`[MATCH ENGINE START] backfillMatchesForSearchProfile profile=${searchProfileId}`);

  const { data: profile, error: pErr } = await supabase
    .from("search_profiles")
    .select("*")
    .eq("id", searchProfileId)
    .single();

  if (pErr || !profile) {
    log(`[MATCH ENGINE COMPLETE] profile not found, 0 matches`);
    return 0;
  }

  const sp = profile as SearchProfile;


  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: listings, error: lErr } = await supabase
    .from("listings")
    .select("id, source, url, title, city, price, bedrooms, size_m2")
    .gte("created_at", sevenDaysAgo);

  if (lErr || !listings || listings.length === 0) {
    log(`[MATCH ENGINE COMPLETE] no recent listings found, 0 matches`);
    return 0;
  }

  let totalMatches = 0;

  for (const listing of listings as DbListing[]) {
    if (!doesListingMatchProfile(listing, sp)) continue;

    const created = await insertMatchIfNew(sp.user_id, sp.id, listing.id);
    if (created) totalMatches++;
  }

  if (totalMatches > 0) {
    const { data: userData } = await supabase.auth.admin.getUserById(sp.user_id);
    const email = userData?.user?.email;
    const sampleListing = listings.find(l => doesListingMatchProfile(l as DbListing, sp));
    if (sampleListing) {
      sendMatchAlerts(sp.user_id, email ?? undefined, sampleListing as DbListing, supabase).catch((err) => {
        log(`[ALERT ERROR] Failed to send backfill alerts for user=${sp.user_id}: ${err?.message ?? err}`);
      });
    }
  }

  log(`[MATCH ENGINE COMPLETE] profile=${searchProfileId} matches=${totalMatches} (from ${listings.length} recent listings)`);
  return totalMatches;
}
