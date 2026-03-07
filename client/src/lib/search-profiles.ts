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
}

const OPTIONAL_COLUMNS = [
  "city_name", "country_code", "latitude", "longitude", "place_id",
  "location_mode", "districts", "radius_km",
  "commute_destination", "commute_lat", "commute_lng", "commute_mode", "commute_minutes",
] as const;

export async function getSearchProfiles(): Promise<SearchProfile[]> {
  const { data, error } = await supabase
    .from("search_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createSearchProfile(
  input: InsertSearchProfileInput
): Promise<SearchProfile> {
  const fullRow: Record<string, unknown> = {
    user_id: input.user_id,
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
  };

  if (input.location_mode) fullRow.location_mode = input.location_mode;
  if (input.districts && input.districts.length > 0) fullRow.districts = input.districts;
  if (input.radius_km != null) fullRow.radius_km = input.radius_km;
  if (input.commute_destination) fullRow.commute_destination = input.commute_destination;
  if (input.commute_lat != null) fullRow.commute_lat = input.commute_lat;
  if (input.commute_lng != null) fullRow.commute_lng = input.commute_lng;
  if (input.commute_mode) fullRow.commute_mode = input.commute_mode;
  if (input.commute_minutes != null) fullRow.commute_minutes = input.commute_minutes;

  const { data, error } = await supabase
    .from("search_profiles")
    .insert(fullRow)
    .select()
    .single();

  if (!error) return data as SearchProfile;

  const msg = error.message ?? "";
  const code = (error as any).code ?? "";
  const isSchemaError =
    (code === "PGRST204" || msg.includes("schema cache") || msg.includes("column")) &&
    OPTIONAL_COLUMNS.some((col) => msg.includes(col));

  if (isSchemaError) {
    console.error("[search-profiles] Some columns not yet in Supabase — saving core only:", error.message);
    const coreRow: Record<string, unknown> = {
      user_id: input.user_id,
      city: input.city_name,
      price_min: input.price_min,
      price_max: input.price_max,
      bedrooms_min: input.bedrooms_min,
      size_min: input.size_min,
    };
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("search_profiles")
      .insert(coreRow)
      .select()
      .single();

    if (fallbackError) {
      console.error("[search-profiles] Fallback insert also failed:", fallbackError);
      throw new Error("Zoekopdracht opslaan mislukt. Controleer je locatie en probeer opnieuw.");
    }
    return fallbackData as SearchProfile;
  }

  console.error("[search-profiles] Insert failed:", error);
  throw new Error("Zoekopdracht opslaan mislukt. Controleer je locatie en probeer opnieuw.");
}

export async function deleteSearchProfile(id: string): Promise<void> {
  const { error } = await supabase
    .from("search_profiles")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
