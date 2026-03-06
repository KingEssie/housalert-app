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
  const resp = await fetch("/api/freshness", {
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
    await fetch("/api/match-alert", {
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
  source: string;
  url: string | null;
  first_seen_at: string;
  fresh_label: "net_binnen" | "nieuw" | "vandaag" | "ouder";
}

export interface ApiMatch extends FreshListing {
  listing_id: string;
  matched_at: string;
  image_url?: string | null;
}

export async function fetchFreshListings(): Promise<FreshListing[]> {
  const resp = await fetch("/api/listings/fresh");
  if (!resp.ok) throw new Error("Verse woningen laden mislukt");
  return resp.json();
}

export async function fetchApiMatches(token: string): Promise<ApiMatch[]> {
  const resp = await fetch("/api/matches", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error("Matches laden mislukt");
  return resp.json();
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
