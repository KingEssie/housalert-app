import { createClient } from "@supabase/supabase-js";
import { bufferMatchAlert } from "../notifications/buffer";
import { trackMatchCreated } from "../freshness";
import { getSubscriptionStatus } from "../subscriptions";
import { upsertUserMatch } from "../user-matches";

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
  furnished?: string | null;
  extra_features?: string[] | null;
  target_categories?: string[] | null;
  districts?: string[] | null;
  property_types?: string[] | null;
  location_mode?: string | null;
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
  image_url?: string | null;
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

const LISTING_SELECT = "id, source, url, title, city, price, bedrooms, size_m2, image_url, furnished, pets_allowed, balcony, elevator, district, latitude, longitude, extra_features, target_categories";

let hasFurnishedColumn: boolean | null = null;
let hasDistrictColumn: boolean | null = null;
let hasAdvancedListingColumns: boolean | null = null;

async function checkFurnishedColumn(): Promise<boolean> {
  if (hasFurnishedColumn !== null) return hasFurnishedColumn;
  const { error } = await supabase.from("listings").select("furnished").limit(1);
  hasFurnishedColumn = !error;
  return hasFurnishedColumn;
}

async function checkDistrictColumn(): Promise<boolean> {
  if (hasDistrictColumn !== null) return hasDistrictColumn;
  const { error } = await supabase.from("listings").select("district").limit(1);
  hasDistrictColumn = !error;
  return hasDistrictColumn;
}

async function checkAdvancedListingColumns(): Promise<boolean> {
  if (hasAdvancedListingColumns !== null) return hasAdvancedListingColumns;
  const { error } = await supabase.from("listings").select("pets_allowed, balcony, elevator").limit(1);
  hasAdvancedListingColumns = !error;
  return hasAdvancedListingColumns;
}

function getListingSelect(): string {
  const base = "id, source, url, title, city, price, bedrooms, size_m2, image_url";
  const parts = [base];
  if (hasFurnishedColumn !== false) parts.push("furnished");
  if (hasDistrictColumn !== false) parts.push("district");
  if (hasAdvancedListingColumns !== false) parts.push("pets_allowed, balcony, elevator, latitude, longitude, extra_features, target_categories");
  return parts.join(", ");
}

export interface FilterCheck {
  filter: string;
  profileField: string;
  profileValue: string;
  listingField: string;
  listingValue: string;
  rule: string;
  passed: boolean;
  hybridPass?: boolean;
}

export interface MatchExplanation {
  matched: boolean;
  checks: FilterCheck[];
  reason: string;
}

function mapExtraFeatureToListingField(feature: string, listing: DbListing): { value: boolean | null; fieldName: string } {
  switch (feature) {
    case "pets_allowed":
    case "huisdieren": return { value: listing.pets_allowed ?? null, fieldName: "pets_allowed" };
    case "balcony":
    case "balkon": return { value: listing.balcony ?? null, fieldName: "balcony" };
    case "elevator":
    case "lift": return { value: listing.elevator ?? null, fieldName: "elevator" };
    case "parking":
    case "parkeerplaats":
    case "garden":
    case "tuin":
    case "basement":
    case "kelder":
      return { value: null, fieldName: feature };
    default: return { value: null, fieldName: feature };
  }
}

export function explainMatchInternal(listing: DbListing, profile: SearchProfile): MatchExplanation {
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

  if (profile.furnished && profile.furnished !== "any" && profile.furnished !== "no_preference") {
    const listingFurnished = listing.furnished ?? null;
    let furnishedPassed: boolean;
    let isHybridPass = false;
    let rule: string;
    if (profile.furnished === "unfurnished") {
      if (listingFurnished === null) {
        furnishedPassed = true;
        isHybridPass = true;
        rule = "hybrid: profile requires unfurnished → listing.furnished is null/unknown → allowed (hybrid pass)";
      } else {
        furnishedPassed = listingFurnished === false;
        rule = "hybrid: profile requires unfurnished → listing.furnished is known → must be false";
      }
    } else {
      if (listingFurnished === null) {
        furnishedPassed = true;
        isHybridPass = true;
        rule = "hybrid: profile requires furnished → listing.furnished is null/unknown → allowed (hybrid pass)";
      } else {
        furnishedPassed = listingFurnished === true;
        rule = "hybrid: profile requires furnished → listing.furnished is known → must be true";
      }
    }
    checks.push({
      filter: "furnished",
      profileField: "furnished",
      profileValue: profile.furnished,
      listingField: "furnished",
      listingValue: String(listingFurnished),
      rule,
      passed: furnishedPassed,
      hybridPass: isHybridPass,
    });
    if (!furnishedPassed) {
      return { matched: false, checks, reason: `Furnished filter: profile=${profile.furnished} but listing.furnished=${listingFurnished}` };
    }
  }

  const HYBRID_FEATURES = new Set(["pets_allowed", "huisdieren"]);

  if (profile.extra_features && profile.extra_features.length > 0) {
    for (const feature of profile.extra_features) {
      const { value, fieldName } = mapExtraFeatureToListingField(feature, listing);
      const isHybridFeature = HYBRID_FEATURES.has(feature);
      let featurePassed: boolean;
      let isHybridPass = false;
      let rule: string;
      if (value === null && isHybridFeature) {
        featurePassed = true;
        isHybridPass = true;
        rule = `hybrid: profile requires ${feature} → listing.${fieldName} is null/unknown → allowed (hybrid pass)`;
      } else if (value === null) {
        featurePassed = false;
        rule = `strict: profile requires ${feature} → listing.${fieldName} is null/unknown → rejected`;
      } else {
        featurePassed = value === true;
        rule = isHybridFeature
          ? `hybrid: profile requires ${feature} → listing.${fieldName} is known (${value}) → must be true`
          : `strict: profile requires ${feature} → listing.${fieldName} must be true`;
      }
      checks.push({
        filter: `extra_feature:${feature}`,
        profileField: "extra_features",
        profileValue: feature,
        listingField: fieldName,
        listingValue: String(value),
        rule,
        passed: featurePassed,
        hybridPass: isHybridPass,
      });
      if (!featurePassed) {
        return { matched: false, checks, reason: `Feature "${feature}" required but listing.${fieldName}=${value}` };
      }
    }
  }

  const districtFilterActive = profile.districts && profile.districts.length > 0 &&
    (!profile.location_mode || profile.location_mode === "districts");

  if (districtFilterActive) {
    const listingDistrict = (listing.district ?? "").toLowerCase().trim();
    let districtPassed: boolean;
    let isHybridPass = false;
    let rule: string;
    if (!listingDistrict) {
      districtPassed = true;
      isHybridPass = true;
      rule = "hybrid: listing.district is null/unknown → allowed (hybrid pass)";
    } else {
      districtPassed = profile.districts.some(d =>
        listingDistrict.includes(d.toLowerCase().trim()) ||
        d.toLowerCase().trim().includes(listingDistrict)
      );
      rule = districtPassed
        ? "hybrid: listing.district is known and matches profile districts → allowed"
        : "hybrid: listing.district is known but does NOT match profile districts → rejected";
    }
    checks.push({
      filter: "district",
      profileField: "districts",
      profileValue: JSON.stringify(profile.districts),
      listingField: "district",
      listingValue: listing.district ?? "(null)",
      rule,
      passed: districtPassed,
      hybridPass: isHybridPass,
    });
    if (!districtPassed) {
      return { matched: false, checks, reason: `District "${listing.district}" not in profile districts ${JSON.stringify(profile.districts)}` };
    }
  }

  return { matched: true, checks, reason: "All active filters passed" };
}

function doesListingMatchProfile(listing: DbListing, profile: SearchProfile): boolean {
  return explainMatchInternal(listing, profile).matched;
}

export async function explainMatch(
  listingId: string,
  profileId: string
): Promise<MatchExplanation & { listing?: DbListing; profile?: SearchProfile }> {
  await checkFurnishedColumn();
  await checkDistrictColumn();
  await checkAdvancedListingColumns();

  const { data: listing } = await supabase
    .from("listings")
    .select(getListingSelect())
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
  await checkFurnishedColumn();
  await checkDistrictColumn();
  await checkAdvancedListingColumns();

  const { data: listing } = await supabase
    .from("listings")
    .select(getListingSelect())
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
  listingId: string,
  listing?: DbListing | null
): Promise<{ created: false } | { created: true; matched_at: string }> {
  const { data: existing } = await supabase
    .from("matches")
    .select("id")
    .eq("user_id", userId)
    .eq("search_profile_id", searchProfileId)
    .eq("listing_id", listingId)
    .maybeSingle();

  if (existing) {
    log(`[MATCH SKIPPED DUPLICATE] user=${userId} profile=${searchProfileId} listing=${listingId}`);
    return { created: false };
  }

  const { data: matchRow, error: mErr } = await supabase
    .from("matches")
    .insert({
      user_id: userId,
      search_profile_id: searchProfileId,
      listing_id: listingId,
    })
    .select("id, created_at")
    .single();

  if (mErr) {
    if (mErr.code === "23505") {
      log(`[MATCH SKIPPED DUPLICATE] user=${userId} profile=${searchProfileId} listing=${listingId}`);
      return { created: false };
    }
    log(`[MATCH ERROR] ${mErr.message}`);
    return { created: false };
  }

  log(`[MATCH CREATED] id=${matchRow.id} user=${userId} profile=${searchProfileId} listing=${listingId}`);
  trackMatchCreated(matchRow.id).catch(() => {});

  try {
    await upsertUserMatch({
      user_id: userId,
      listing_id: listingId,
      search_profile_id: searchProfileId,
      listing_title: listing?.title,
      listing_city: listing?.city,
      listing_price: listing?.price,
      listing_source: listing?.source,
      listing_url: listing?.url,
      dedup_key: listing ? `${listing.source}:${listingId}` : undefined,
      matched_at: matchRow.created_at,
    });
  } catch (e: any) {
    log(`[MATCH ENGINE] user_matches upsert failed (non-blocking): ${e.message}`);
  }

  return { created: true, matched_at: matchRow.created_at };
}

export async function matchListingAgainstProfiles(listingId: string): Promise<number> {
  log(`[MATCH ENGINE START] matchListingAgainstProfiles listing=${listingId}`);

  await checkFurnishedColumn();
  await checkDistrictColumn();
  await checkAdvancedListingColumns();

  const { data: listing, error: lErr } = await supabase
    .from("listings")
    .select(getListingSelect())
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
  const resolvedEmails = new Map<string, string>();
  const userSubCache = new Map<string, { hasAccess: boolean }>();

  for (const profile of profiles as SearchProfile[]) {
    if (!doesListingMatchProfile(listing as DbListing, profile)) continue;

    const result = await insertMatchIfNew(profile.user_id, profile.id, listing.id, listing as DbListing);
    if (!result.created) continue;

    totalMatches++;

    if (!userSubCache.has(profile.user_id)) {
      const subStatus = await getSubscriptionStatus(profile.user_id);
      userSubCache.set(profile.user_id, { hasAccess: subStatus.isActive || subStatus.isTrial });
    }

    if (!userSubCache.get(profile.user_id)!.hasAccess) {
      log(`[MATCH ENGINE] Skipping alert buffer for user ${profile.user_id.substring(0, 8)}... — no active subscription`);
      continue;
    }

    if (!resolvedEmails.has(profile.user_id)) {
      const { data: userData } = await supabase.auth.admin.getUserById(profile.user_id);
      resolvedEmails.set(profile.user_id, userData?.user?.email ?? "");
    }

    const email = resolvedEmails.get(profile.user_id);
    if (email) {
      const l = listing as DbListing;
      bufferMatchAlert(profile.user_id, email, {
        listing_id: l.id,
        title: l.title,
        city: l.city,
        price: l.price,
        bedrooms: l.bedrooms,
        size_m2: l.size_m2,
        url: l.url,
        image_url: l.image_url,
        matched_at: result.matched_at,
      });
    }
  }

  log(`[MATCH ENGINE COMPLETE] listing=${listingId} matches=${totalMatches}`);
  return totalMatches;
}

export async function backfillMatchesForSearchProfile(searchProfileId: string): Promise<number> {
  log(`[MATCH ENGINE START] backfillMatchesForSearchProfile profile=${searchProfileId}`);

  await checkFurnishedColumn();
  await checkDistrictColumn();
  await checkAdvancedListingColumns();

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

  const profileCity = (sp.city_name || sp.city || "").toLowerCase().trim().replace(/[%_\\,()]/g, "");

  let listings: any[] | null = null;
  let lErr: any = null;

  if (profileCity.length >= 3) {
    const result = await supabase
      .from("listings")
      .select(getListingSelect())
      .gte("created_at", sevenDaysAgo)
      .ilike("city", `%${profileCity}%`);
    listings = result.data;
    lErr = result.error;
    if (lErr) {
      log(`[MATCH ENGINE] City-filtered listing query failed, falling back to full scan: ${lErr.message}`);
      const fallback = await supabase.from("listings").select(getListingSelect()).gte("created_at", sevenDaysAgo);
      listings = fallback.data;
      lErr = fallback.error;
    } else {
      log(`[MATCH ENGINE] Backfill pre-filtered to ${listings?.length ?? 0} listings in city="${profileCity}"`);
    }
  } else {
    const result = await supabase.from("listings").select(getListingSelect()).gte("created_at", sevenDaysAgo);
    listings = result.data;
    lErr = result.error;
  }

  if (lErr || !listings || listings.length === 0) {
    log(`[MATCH ENGINE COMPLETE] no recent listings found for city="${profileCity}", 0 matches`);
    return 0;
  }

  let totalMatches = 0;
  const matchedEntries: { listing: DbListing; matched_at: string }[] = [];

  for (const listing of listings as DbListing[]) {
    if (!doesListingMatchProfile(listing, sp)) continue;

    const result = await insertMatchIfNew(sp.user_id, sp.id, listing.id, listing);
    if (result.created) {
      totalMatches++;
      matchedEntries.push({ listing, matched_at: result.matched_at });
    }
  }

  if (matchedEntries.length > 0) {
    const subStatus = await getSubscriptionStatus(sp.user_id);
    if (subStatus.isActive || subStatus.isTrial) {
      const { data: userData } = await supabase.auth.admin.getUserById(sp.user_id);
      const email = userData?.user?.email;
      if (email) {
        for (const { listing: l, matched_at } of matchedEntries) {
          bufferMatchAlert(sp.user_id, email, {
            listing_id: l.id,
            title: l.title,
            city: l.city,
            price: l.price,
            bedrooms: l.bedrooms,
            size_m2: l.size_m2,
            url: l.url,
            image_url: l.image_url,
            matched_at,
          });
        }
      }
    } else {
      log(`[MATCH ENGINE] Skipping alert buffer for backfill user ${sp.user_id.substring(0, 8)}... — no active subscription`);
    }
  }

  log(`[MATCH ENGINE COMPLETE] profile=${searchProfileId} matches=${totalMatches} (from ${listings.length} recent listings)`);
  return totalMatches;
}
