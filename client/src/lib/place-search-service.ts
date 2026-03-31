import type { LocationResult } from "./location-types";
import { USE_MAPBOX_GEOCODER, MAPBOX_TOKEN } from "./feature-flags";

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
    if (options.language) params.set("language", options.language);
    const res = await fetch(`/api/places/autocomplete?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    let results: LocationResult[] = (data.suggestions ?? []).map((s: any) => ({
      label: s.state ? `${s.city_name}, ${s.state}` : s.city_name,
      city: s.city_name,
      country: s.country_code ?? "DE",
      lat: s.latitude ?? 0,
      lng: s.longitude ?? 0,
      source: "google" as const,
      placeId: s.place_id,
    }));
    if (options.limit) results = results.slice(0, options.limit);
    if (options.countryCodes?.length) {
      const codes = options.countryCodes.map((c) => c.toUpperCase());
      results = results.filter((r) => codes.includes(r.country.toUpperCase()));
    }
    return results;
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

  async search(query: string, options: PlaceSearchOptions = {}): Promise<LocationResult[]> {
    if (!MAPBOX_TOKEN) return [];

    const countries = (options.countryCodes ?? ["de"]).join(",");
    const limit = Math.min(options.limit ?? 5, 10);
    const lang = options.language ?? "de";

    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      autocomplete: "true",
      types: "place,locality",
      country: countries,
      limit: String(limit),
      language: lang,
    });

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`;

    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();

    return (data.features ?? []).map((f: any) => {
      const context = f.context ?? [];
      const regionCtx = context.find((c: any) => c.id?.startsWith("region"));
      const countryCtx = context.find((c: any) => c.id?.startsWith("country"));
      const cityName = f.text ?? f.place_name ?? "";
      const region = regionCtx?.text ?? "";
      const countryCode = (countryCtx?.short_code ?? countries.split(",")[0]).toUpperCase();

      return {
        label: region ? `${cityName}, ${region}` : cityName,
        city: cityName,
        country: countryCode,
        lat: f.center[1],
        lng: f.center[0],
        bbox: f.bbox ? [f.bbox[0], f.bbox[1], f.bbox[2], f.bbox[3]] as [number, number, number, number] : undefined,
        source: "mapbox" as const,
        placeId: f.id ?? "",
      };
    });
  }
}

const nominatimFallback = new NominatimProvider();
const mapboxProvider = new MapboxGeocoderProvider();

export async function geocoderSearch(
  query: string,
  options: PlaceSearchOptions = {}
): Promise<LocationResult[]> {
  if (USE_MAPBOX_GEOCODER && MAPBOX_TOKEN) {
    try {
      const results = await mapboxProvider.search(query, options);
      if (results.length > 0) return results;
    } catch (err) {
      console.warn("[geocoderSearch] Mapbox failed, falling back to Nominatim:", err);
    }
  }
  return nominatimFallback.search(query, options);
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
