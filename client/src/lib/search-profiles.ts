import { apiFetch } from "@/lib/api-base";
import { supabase } from "./supabase";

export type LocationMode = "city" | "districts" | "radius" | "commute";

export interface SearchProfile {
  id: string;
  user_id: string;
  city: string;
  city_name?: string;
  country_code?: string;
  latitude?: number;
  longitude?: number;
  place_id?: string;
  price_min: number;
  price_max: number;
  bedrooms_min: number;
  size_min: number;
  location_mode?: LocationMode;
  districts?: string[];
  radius_km?: number;
  commute_destination?: string;
  commute_lat?: number;
  commute_lng?: number;
  commute_mode?: string;
  commute_minutes?: number;
  furnished?: string;
  property_types?: string[];
  extra_features?: string[];
  target_categories?: string[];
  send_unclear?: boolean;
  price_flexible?: boolean;
  search_name?: string;
  created_at: string;
}

export interface InsertSearchProfileInput {
  user_id: string;
  city_name: string;
  country_code?: string;
  latitude?: number;
  longitude?: number;
  place_id?: string;
  price_min: number;
  price_max: number;
  bedrooms_min: number;
  size_min: number;
  location_mode?: LocationMode;
  districts?: string[];
  radius_km?: number;
  commute_destination?: string;
  commute_lat?: number;
  commute_lng?: number;
  commute_mode?: string;
  commute_minutes?: number;
  furnished?: string;
  property_types?: string[];
  extra_features?: string[];
  target_categories?: string[];
  send_unclear?: boolean;
  price_flexible?: boolean;
  search_name?: string;
}

const OPTIONAL_COLUMNS = [
  "city_name", "country_code", "latitude", "longitude", "place_id",
  "location_mode", "districts", "radius_km",
  "commute_destination", "commute_lat", "commute_lng", "commute_mode", "commute_minutes",
  "furnished", "property_types", "extra_features", "target_categories",
  "send_unclear", "price_flexible", "search_name",
] as const;

export async function getSearchProfiles(): Promise<SearchProfile[]> {
  const { data, error } = await supabase
    .from("search_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

const MAX_SEARCH_PROFILES = 4;

export async function createSearchProfile(
  input: InsertSearchProfileInput
): Promise<SearchProfile> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Nicht eingeloggt.");

  const { count, error: countErr } = await supabase
    .from("search_profiles")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.user_id);

  if (!countErr && count != null && count >= MAX_SEARCH_PROFILES) {
    throw new Error("Je kunt maximaal 4 zoekopdrachten aanmaken.");
  }

  console.log("[search-profiles] createSearchProfile — city:", input.city_name, "search_name:", input.search_name ?? "(none)");

  const res = await apiFetch("/api/search-profiles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    if (err.error === "profile_limit_reached") {
      throw new Error(err.message || "Je kunt maximaal 4 zoekopdrachten aanmaken.");
    }
    console.error("[search-profiles] API create failed:", res.status, err);
    throw new Error("Suchauftrag konnte nicht gespeichert werden. Überprüfe deinen Standort und versuche es erneut.");
  }

  const data = await res.json();
  console.log("[search-profiles] Insert OK — saved search_name:", data.search_name ?? "(null)");
  return data as SearchProfile;
}

export async function updateSearchProfile(
  id: string,
  input: InsertSearchProfileInput
): Promise<{ success: boolean }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Nicht eingeloggt.");

  console.log("[search-profiles] updateSearchProfile — id:", id, "city:", input.city_name, "search_name:", input.search_name ?? "(none/clear)");

  const body: Record<string, unknown> = {
    city: input.city_name,
    city_name: input.city_name,
    country_code: input.country_code ?? "DE",
    latitude: input.latitude,
    longitude: input.longitude,
    place_id: input.place_id,
    price_min: input.price_min,
    price_max: input.price_max,
    bedrooms_min: input.bedrooms_min,
    size_min: input.size_min,
    location_mode: input.location_mode || null,
    districts: input.districts && input.districts.length > 0 ? input.districts : null,
    radius_km: input.radius_km ?? null,
    commute_destination: input.commute_destination || null,
    commute_lat: input.commute_lat ?? null,
    commute_lng: input.commute_lng ?? null,
    commute_mode: input.commute_mode || null,
    commute_minutes: input.commute_minutes ?? null,
    furnished: input.furnished || null,
    property_types: input.property_types && input.property_types.length > 0 ? input.property_types : null,
    extra_features: input.extra_features && input.extra_features.length > 0 ? input.extra_features : null,
    target_categories: input.target_categories && input.target_categories.length > 0 ? input.target_categories : null,
    send_unclear: input.send_unclear != null ? input.send_unclear : true,
    price_flexible: input.price_flexible != null ? input.price_flexible : false,
    search_name: input.search_name || null,
  };

  const res = await apiFetch(`/api/search-profiles/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    console.error("[search-profiles] Update failed:", res.status, err);
    throw new Error("Suchauftrag konnte nicht aktualisiert werden. Bitte erneut versuchen.");
  }

  return { success: true };
}

export async function getSearchProfile(id: string): Promise<SearchProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("search_profiles")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) return null;
  return data as SearchProfile;
}

export async function deleteSearchProfile(id: string): Promise<void> {
  const { error } = await supabase
    .from("search_profiles")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
