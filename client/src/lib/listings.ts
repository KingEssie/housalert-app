import { apiFetch } from "@/lib/api-base";
import { supabase } from "./supabase";
import type { SearchProfile } from "./search-profiles";

export interface Listing {
  id: string;
  source: string;
  url: string | null;
  title: string;
  city: string;
  price: number;
  bedrooms: number;
  size_m2: number;
  created_at: string;
}

export interface InsertListing {
  source?: string;
  url?: string;
  title: string;
  city: string;
  price: number;
  bedrooms: number;
  size_m2: number;
}

export interface Match {
  id: string;
  user_id: string;
  search_profile_id: string;
  listing_id: string;
  created_at: string;
}

export interface FreshnessData {
  listings: Record<string, { first_seen_at: string; last_seen_at: string }>;
  matches: Record<string, string>;
}

export async function fetchFreshness(
  listingIds: string[],
  matchIds: string[]
): Promise<FreshnessData> {
  const resp = await apiFetch("/api/freshness", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listingIds, matchIds }),
  });
  if (!resp.ok) return { listings: {}, matches: {} };
  return resp.json();
}

export interface MatchWithListing extends Match {
  listing: Listing;
}

export async function createListing(listing: InsertListing): Promise<Listing> {
  const { data, error } = await supabase
    .from("listings")
    .insert({ ...listing, source: listing.source ?? "manual" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getMatchesForUser(userId: string): Promise<MatchWithListing[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("*, listing:listings(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((m: any) => ({
    ...m,
    listing: m.listing,
  }));
}

function doesListingMatchProfile(listing: Listing, profile: SearchProfile): boolean {
  const listingCity = listing.city.toLowerCase().trim();
  const profileCity = profile.city.toLowerCase().trim();
  if (!listingCity.includes(profileCity) && !profileCity.includes(listingCity)) {
    return false;
  }

  if (profile.price_min > 0 && listing.price < profile.price_min) {
    return false;
  }
  if (profile.price_max > 0 && listing.price > profile.price_max) {
    return false;
  }

  if (profile.bedrooms_min > 0 && listing.bedrooms < profile.bedrooms_min) {
    return false;
  }

  if (profile.size_min > 0 && listing.size_m2 < profile.size_min) {
    return false;
  }

  return true;
}

async function sendMatchAlertToServer(userEmail: string, listing: Listing) {
  try {
    await apiFetch("/api/match-alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userEmail, listing }),
    });
  } catch {
  }
}

export interface FreshListing {
  title: string;
  price: number;
  size_m2: number;
  bedrooms: number;
  city: string;
  district?: string | null;
  source: string;
  url: string | null;
  first_seen_at: string;
  fresh_label: "net_binnen" | "nieuw" | "vandaag" | "ouder";
}

export type HybridStatus = "confirmed" | "unknown" | "not_filtered";

export interface HybridFilters {
  furnished: HybridStatus;
  district: HybridStatus;
  pets: HybridStatus;
}

export interface ApiMatch extends FreshListing {
  listing_id: string;
  matched_at: string;
  image_url?: string | null;
  match_score?: number | null;
  match_label?: string | null;
  match_reasons?: string[];
  hybrid_filters?: HybridFilters | null;
  in_latest_email?: boolean;
  canonical_viewed?: boolean;
  canonical_saved?: boolean;
  canonical_applied?: boolean;
  canonical_dismissed?: boolean;
}

export async function fetchFreshListings(): Promise<FreshListing[]> {
  const resp = await apiFetch("/api/listings/fresh");
  if (!resp.ok) throw new Error("Neue Wohnungen konnten nicht geladen werden");
  return resp.json();
}

export interface CanonicalStats {
  total: number;
  new_count: number;
  viewed: number;
  saved: number;
  applied: number;
  email_sent: number;
  push_sent: number;
}

export interface ApiMatchesResponse {
  matches: ApiMatch[];
  totalCount: number;
  newCount?: number;
  canonicalStats?: CanonicalStats;
  latestEmailAt?: string | null;
}

export async function fetchApiMatches(token: string): Promise<ApiMatchesResponse> {
  const t0 = performance.now();
  const resp = await apiFetch("/api/matches", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const tNetwork = Math.round(performance.now() - t0);
  if (!resp.ok) throw new Error("Matches konnten nicht geladen werden");
  const text = await resp.text();
  const tParse0 = performance.now();
  const data = JSON.parse(text);
  const tParse = Math.round(performance.now() - tParse0);
  const payloadKB = Math.round(text.length / 1024);
  console.log(`[PERF] /api/matches network=${tNetwork}ms parse=${tParse}ms payload=${payloadKB}KB matches=${data.matches?.length ?? (Array.isArray(data) ? data.length : "?")} total=${Math.round(performance.now() - t0)}ms`);
  if (Array.isArray(data)) {
    return { matches: data, totalCount: data.length };
  }
  return data as ApiMatchesResponse;
}

export async function fetchBuddySharedMatches(token: string): Promise<ApiMatchesResponse> {
  const resp = await apiFetch("/api/buddy/shared-matches", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error("Buddy matches could not be loaded");
  const data = await resp.json();
  const matches = data.matches || [];
  return { matches, totalCount: data.total ?? matches.length };
}

export async function matchListingForUser(
  listing: Listing,
  userId: string,
  profiles: SearchProfile[],
  userEmail?: string
): Promise<number> {
  let matchCount = 0;
  let alertSent = false;

  for (const profile of profiles) {
    if (!doesListingMatchProfile(listing, profile)) continue;

    const { data: existing } = await supabase
      .from("matches")
      .select("id")
      .eq("user_id", userId)
      .eq("search_profile_id", profile.id)
      .eq("listing_id", listing.id)
      .maybeSingle();

    if (existing) continue;

    const { error } = await supabase.from("matches").insert({
      user_id: userId,
      search_profile_id: profile.id,
      listing_id: listing.id,
    });

    if (!error) {
      matchCount++;
      if (userEmail && !alertSent) {
        sendMatchAlertToServer(userEmail, listing);
        alertSent = true;
      }
    }
  }

  return matchCount;
}
