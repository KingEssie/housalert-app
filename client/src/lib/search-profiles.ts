import { supabase } from "./supabase";

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
  created_at: string;
}

export type InsertSearchProfile = Omit<SearchProfile, "id" | "created_at">;

export async function getSearchProfiles(): Promise<SearchProfile[]> {
  const { data, error } = await supabase
    .from("search_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createSearchProfile(profile: InsertSearchProfile): Promise<SearchProfile> {
  const { data, error } = await supabase
    .from("search_profiles")
    .insert(profile)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSearchProfile(id: string): Promise<void> {
  const { error } = await supabase
    .from("search_profiles")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
