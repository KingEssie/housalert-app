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

function doesListingMatchProfile(listing: DbListing, profile: SearchProfile): boolean {
  const listingCity = listing.city.toLowerCase().trim();
  const profileCity = (profile.city_name || profile.city || "").toLowerCase().trim();
  if (!profileCity) return false;
  if (!listingCity.includes(profileCity) && !profileCity.includes(listingCity)) {
    return false;
  }
  if (profile.price_min > 0 && listing.price < profile.price_min) return false;
  if (profile.price_max > 0 && listing.price > profile.price_max) return false;
  if (profile.bedrooms_min > 0 && listing.bedrooms < profile.bedrooms_min) return false;
  if (profile.size_min > 0 && listing.size_m2 < profile.size_min) return false;
  return true;
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
      .or(`city.ilike.%${safeCity}%,city_name.ilike.%${safeCity}%`);
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
