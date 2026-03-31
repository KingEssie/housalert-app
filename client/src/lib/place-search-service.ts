import type { LocationResult } from "./location-types";

export interface PlaceSearchProvider {
  name: string;
  search(query: string, options?: PlaceSearchOptions): Promise<LocationResult[]>;
  getDetails?(placeId: string): Promise<LocationResult | null>;
}

export interface PlaceSearchOptions {
  countryCodes?: string[];
  limit?: number;
  language?: string;
  types?: string[];
}

export class GooglePlacesProvider implements PlaceSearchProvider {
  name = "google" as const;
  private sessionToken: string;

  constructor() {
    this.sessionToken = crypto.randomUUID?.() ?? Math.random().toString(36).substring(2);
  }

  async search(query: string, options: PlaceSearchOptions = {}): Promise<LocationResult[]> {
    const params = new URLSearchParams({
      input: query,
      session_token: this.sessionToken,
    });
    const res = await fetch(`/api/places/autocomplete?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.suggestions ?? []).map((s: any) => ({
      label: s.state ? `${s.city_name}, ${s.state}` : s.city_name,
      city: s.city_name,
      country: s.country_code ?? "DE",
      lat: s.latitude ?? 0,
      lng: s.longitude ?? 0,
      source: "google" as const,
      placeId: s.place_id,
    }));
  }

  async getDetails(placeId: string): Promise<LocationResult | null> {
    const params = new URLSearchParams({
      place_id: placeId,
      session_token: this.sessionToken,
    });
    this.sessionToken = crypto.randomUUID?.() ?? Math.random().toString(36).substring(2);

    const res = await fetch(`/api/places/details?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    const p = data.place;
    if (!p) return null;

    return {
      label: p.display_name ?? p.city_name,
      city: p.city_name,
      country: p.country_code ?? "DE",
      lat: p.latitude ?? 0,
      lng: p.longitude ?? 0,
      source: "google",
      placeId: p.place_id,
    };
  }
}

export class NominatimProvider implements PlaceSearchProvider {
  name = "nominatim" as const;

  async search(query: string, options: PlaceSearchOptions = {}): Promise<LocationResult[]> {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      addressdetails: "1",
      countrycodes: (options.countryCodes ?? ["de"]).join(","),
      limit: String(options.limit ?? 8),
      "accept-language": options.language ?? "de",
    });

    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "User-Agent": "HousAlert/1.0" },
    });
    if (!res.ok) return [];
    const data = await res.json();

    return data
      .filter((r: any) => {
        const a = r.address;
        return !!(a?.city || a?.town || a?.village || a?.municipality);
      })
      .map((r: any) => {
        const a = r.address;
        const city = a.city || a.town || a.village || a.municipality || "";
        return {
          label: a.state ? `${city}, ${a.state}` : city,
          city,
          country: a.country_code?.toUpperCase() ?? "DE",
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
          source: "nominatim" as const,
          placeId: String(r.place_id),
        };
      });
  }
}

export class MapboxGeocoderProvider implements PlaceSearchProvider {
  name = "mapbox" as const;

  async search(_query: string, _options: PlaceSearchOptions = {}): Promise<LocationResult[]> {
    throw new Error("MapboxGeocoderProvider is not yet implemented. Enable USE_MAPBOX_GEOCODER when ready.");
  }
}

export function createSearchProvider(provider: "google" | "nominatim" | "mapbox"): PlaceSearchProvider {
  switch (provider) {
    case "google":
      return new GooglePlacesProvider();
    case "nominatim":
      return new NominatimProvider();
    case "mapbox":
      return new MapboxGeocoderProvider();
  }
}
