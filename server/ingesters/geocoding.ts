import { log } from "../log";
import { supabase } from "./matching";

export type CoordinateSource = "direct" | "geocoded" | "city_fallback";
export type CoordinatePrecision = "exact" | "approximate" | "city_level";

export interface ResolvedCoordinates {
  latitude: number;
  longitude: number;
  coordinate_source: CoordinateSource;
  coordinate_precision: CoordinatePrecision;
}

export interface GeocodableFields {
  latitude?: number | null;
  longitude?: number | null;
  city: string;
  postcode?: string | null;
  street?: string | null;
  district?: string | null;
}

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_UA = "HousAlert/1.0 (rental-alert-app; contact: support@housalert.com)";
const NOMINATIM_DELAY_MS = 1500;
const NOMINATIM_MAX_RETRIES = 3;

const geocodeMemoryCache = new Map<string, { lat: number; lng: number } | null>();

let nominatimQueuePromise: Promise<void> = Promise.resolve();

function enqueueNominatim<T>(fn: () => Promise<T>): Promise<T> {
  const result = nominatimQueuePromise.then(fn, fn);
  nominatimQueuePromise = result.then(() => {}, () => {});
  return result;
}

const CITY_CENTER_COORDS: Record<string, { lat: number; lng: number }> = {
  "berlin": { lat: 52.5200, lng: 13.4050 },
  "münchen": { lat: 48.1351, lng: 11.5820 },
  "munich": { lat: 48.1351, lng: 11.5820 },
  "muenchen": { lat: 48.1351, lng: 11.5820 },
  "hamburg": { lat: 53.5511, lng: 9.9937 },
  "köln": { lat: 50.9375, lng: 6.9603 },
  "cologne": { lat: 50.9375, lng: 6.9603 },
  "koeln": { lat: 50.9375, lng: 6.9603 },
  "frankfurt": { lat: 50.1109, lng: 8.6821 },
  "frankfurt am main": { lat: 50.1109, lng: 8.6821 },
  "stuttgart": { lat: 48.7758, lng: 9.1829 },
  "düsseldorf": { lat: 51.2277, lng: 6.7735 },
  "duesseldorf": { lat: 51.2277, lng: 6.7735 },
  "leipzig": { lat: 51.3397, lng: 12.3731 },
  "dresden": { lat: 51.0504, lng: 13.7373 },
  "nürnberg": { lat: 49.4521, lng: 11.0767 },
  "nuernberg": { lat: 49.4521, lng: 11.0767 },
  "hannover": { lat: 52.3759, lng: 9.7320 },
  "dortmund": { lat: 51.5136, lng: 7.4653 },
  "essen": { lat: 51.4556, lng: 7.0116 },
  "bremen": { lat: 53.0793, lng: 8.8017 },
  "duisburg": { lat: 51.4344, lng: 6.7623 },
  "bochum": { lat: 51.4818, lng: 7.2162 },
  "wuppertal": { lat: 51.2562, lng: 7.1508 },
  "bonn": { lat: 50.7374, lng: 7.0982 },
  "münster": { lat: 51.9607, lng: 7.6261 },
  "muenster": { lat: 51.9607, lng: 7.6261 },
  "mannheim": { lat: 49.4875, lng: 8.4660 },
  "karlsruhe": { lat: 49.0069, lng: 8.4037 },
  "augsburg": { lat: 48.3705, lng: 10.8978 },
  "wiesbaden": { lat: 50.0782, lng: 8.2398 },
  "freiburg": { lat: 47.9990, lng: 7.8421 },
  "freiburg im breisgau": { lat: 47.9990, lng: 7.8421 },
  "aachen": { lat: 50.7753, lng: 6.0839 },
  "mainz": { lat: 49.9929, lng: 8.2473 },
  "kiel": { lat: 54.3233, lng: 10.1228 },
  "heidelberg": { lat: 49.3988, lng: 8.6724 },
  "rostock": { lat: 54.0924, lng: 12.0991 },
  "potsdam": { lat: 52.3906, lng: 13.0645 },
  "darmstadt": { lat: 49.8728, lng: 8.6512 },
  "regensburg": { lat: 49.0134, lng: 12.1016 },
  "braunschweig": { lat: 52.2689, lng: 10.5268 },
  "bielefeld": { lat: 52.0302, lng: 8.5325 },
  "erfurt": { lat: 50.9848, lng: 11.0299 },
  "magdeburg": { lat: 52.1205, lng: 11.6276 },
  "lübeck": { lat: 53.8655, lng: 10.6866 },
  "luebeck": { lat: 53.8655, lng: 10.6866 },
  "offenbach": { lat: 50.1005, lng: 8.7628 },
  "offenbach am main": { lat: 50.1005, lng: 8.7628 },
  "fürth": { lat: 49.4774, lng: 10.9888 },
  "fuerth": { lat: 49.4774, lng: 10.9888 },
  "wien": { lat: 48.2082, lng: 16.3738 },
  "vienna": { lat: 48.2082, lng: 16.3738 },
  "zürich": { lat: 47.3769, lng: 8.5417 },
  "zurich": { lat: 47.3769, lng: 8.5417 },
  "zuerich": { lat: 47.3769, lng: 8.5417 },
  "amsterdam": { lat: 52.3676, lng: 4.9041 },
  "rotterdam": { lat: 51.9225, lng: 4.4792 },
  "den haag": { lat: 52.0705, lng: 4.3007 },
  "utrecht": { lat: 52.0907, lng: 5.1214 },
  "nordwalde": { lat: 52.0833, lng: 7.4833 },
};

export { CITY_CENTER_COORDS };

export function normalizeCityKey(city: string): string {
  return city.toLowerCase().trim().replace(/\s+/g, " ");
}

function makeCacheKey(parts: { city: string; postcode?: string | null; street?: string | null; district?: string | null }): string {
  const segments = [parts.city.toLowerCase().trim()];
  if (parts.postcode) segments.push(parts.postcode.trim());
  if (parts.street) segments.push(parts.street.toLowerCase().trim());
  if (parts.district) segments.push(parts.district.toLowerCase().trim());
  return segments.join("|");
}

async function nominatimFetch(query: string): Promise<{ lat: number; lng: number } | null> {
  for (let attempt = 0; attempt < NOMINATIM_MAX_RETRIES; attempt++) {
    const delay = attempt === 0 ? NOMINATIM_DELAY_MS : NOMINATIM_DELAY_MS * Math.pow(2, attempt);
    await new Promise(r => setTimeout(r, delay));

    try {
      const url = `${NOMINATIM_BASE}?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=de,at,ch,nl`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);

      const resp = await fetch(url, {
        headers: {
          "User-Agent": NOMINATIM_UA,
          "Accept": "application/json",
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (resp.status === 429) {
        log(`[GEOCODE] Nominatim 429 for query="${query}", attempt ${attempt + 1}/${NOMINATIM_MAX_RETRIES}, backing off ${delay * 2}ms`);
        continue;
      }

      if (!resp.ok) {
        log(`[GEOCODE] Nominatim returned ${resp.status} for query="${query}"`);
        return null;
      }

      const results = await resp.json() as Array<{ lat: string; lon: string; display_name: string }>;
      if (results.length === 0) {
        return null;
      }

      const lat = parseFloat(results[0].lat);
      const lng = parseFloat(results[0].lon);
      if (isNaN(lat) || isNaN(lng)) return null;

      return { lat, lng };
    } catch (err: any) {
      log(`[GEOCODE] Nominatim error for query="${query}": ${err.message}`);
      return null;
    }
  }

  log(`[GEOCODE] Nominatim exhausted retries for query="${query}"`);
  return null;
}

function rateLimitedNominatimCall(query: string): Promise<{ lat: number; lng: number } | null> {
  return enqueueNominatim(() => nominatimFetch(query));
}

async function loadCachedGeocode(key: string): Promise<{ lat: number; lng: number } | null | undefined> {
  if (geocodeMemoryCache.has(key)) {
    return geocodeMemoryCache.get(key);
  }

  try {
    const { data } = await supabase
      .from("geocode_cache")
      .select("latitude, longitude")
      .eq("cache_key", key)
      .maybeSingle();

    if (data) {
      const result = { lat: data.latitude, lng: data.longitude };
      geocodeMemoryCache.set(key, result);
      return result;
    }
  } catch {
  }

  return undefined;
}

async function storeGeocode(key: string, lat: number, lng: number): Promise<void> {
  geocodeMemoryCache.set(key, { lat, lng });
  try {
    await supabase
      .from("geocode_cache")
      .upsert({ cache_key: key, latitude: lat, longitude: lng, updated_at: new Date().toISOString() }, { onConflict: "cache_key" });
  } catch (err: any) {
    log(`[GEOCODE] Cache store error: ${err.message}`);
  }
}

async function storeNegativeCache(key: string): Promise<void> {
  geocodeMemoryCache.set(key, null);
}

async function geocodeAddress(fields: GeocodableFields): Promise<{ lat: number; lng: number } | null> {
  const parts: string[] = [];
  if (fields.street) parts.push(fields.street);
  if (fields.postcode) parts.push(fields.postcode);
  if (fields.district) parts.push(fields.district);
  parts.push(fields.city);

  const query = parts.join(", ");
  const cacheKey = makeCacheKey(fields);

  const cached = await loadCachedGeocode(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const result = await rateLimitedNominatimCall(query);

  if (result) {
    await storeGeocode(cacheKey, result.lat, result.lng);
  } else {
    await storeNegativeCache(cacheKey);

    if (fields.street || fields.district) {
      const simpler: GeocodableFields = {
        city: fields.city,
        postcode: fields.postcode,
      };
      const simplerKey = makeCacheKey(simpler);
      const simplerCached = await loadCachedGeocode(simplerKey);
      if (simplerCached !== undefined) return simplerCached;

      const simplerQuery = [fields.postcode, fields.city].filter(Boolean).join(", ");
      const simplerResult = await rateLimitedNominatimCall(simplerQuery);
      if (simplerResult) {
        await storeGeocode(simplerKey, simplerResult.lat, simplerResult.lng);
        return simplerResult;
      } else {
        await storeNegativeCache(simplerKey);
      }
    }
  }

  return result;
}

function getCityFallback(city: string): { lat: number; lng: number } | null {
  const key = normalizeCityKey(city);
  return CITY_CENTER_COORDS[key] ?? null;
}

let hasGeocodeCache: boolean | null = null;

async function checkGeocodeCacheTable(): Promise<boolean> {
  if (hasGeocodeCache !== null) return hasGeocodeCache;
  try {
    const { error } = await supabase.from("geocode_cache").select("cache_key").limit(1);
    hasGeocodeCache = !error;
    if (!hasGeocodeCache) {
      log("[GEOCODE] geocode_cache table not found — geocoding will still work but without DB persistence");
    }
  } catch {
    hasGeocodeCache = false;
  }
  return hasGeocodeCache;
}

export function resolveCoordinatesCityOnly(fields: GeocodableFields): ResolvedCoordinates | null {
  if (fields.latitude != null && fields.longitude != null &&
      fields.latitude !== 0 && fields.longitude !== 0 &&
      !isNaN(fields.latitude) && !isNaN(fields.longitude)) {
    return {
      latitude: fields.latitude,
      longitude: fields.longitude,
      coordinate_source: "direct",
      coordinate_precision: "exact",
    };
  }

  const fallback = getCityFallback(fields.city);
  if (fallback) {
    return {
      latitude: fallback.lat,
      longitude: fallback.lng,
      coordinate_source: "city_fallback",
      coordinate_precision: "city_level",
    };
  }

  return null;
}

export async function resolveCoordinates(fields: GeocodableFields): Promise<ResolvedCoordinates | null> {
  if (fields.latitude != null && fields.longitude != null &&
      fields.latitude !== 0 && fields.longitude !== 0 &&
      !isNaN(fields.latitude) && !isNaN(fields.longitude)) {
    return {
      latitude: fields.latitude,
      longitude: fields.longitude,
      coordinate_source: "direct",
      coordinate_precision: "exact",
    };
  }

  await checkGeocodeCacheTable();

  if (fields.postcode || fields.street || fields.district) {
    const geocoded = await geocodeAddress(fields);
    if (geocoded) {
      const precision: CoordinatePrecision = fields.street ? "exact" : "approximate";
      return {
        latitude: geocoded.lat,
        longitude: geocoded.lng,
        coordinate_source: "geocoded",
        coordinate_precision: precision,
      };
    }
  }

  const fallback = getCityFallback(fields.city);
  if (fallback) {
    return {
      latitude: fallback.lat,
      longitude: fallback.lng,
      coordinate_source: "city_fallback",
      coordinate_precision: "city_level",
    };
  }

  const cityGeocoded = await geocodeAddress({ city: fields.city });
  if (cityGeocoded) {
    return {
      latitude: cityGeocoded.lat,
      longitude: cityGeocoded.lng,
      coordinate_source: "city_fallback",
      coordinate_precision: "city_level",
    };
  }

  log(`[GEOCODE] Could not resolve coordinates for city="${fields.city}" — no fallback available`);
  return null;
}

export function extractPostcodeFromText(text: string): string | null {
  const match = text.match(/\b(\d{5})\b/);
  return match ? match[1] : null;
}

export function extractStreetFromAddress(address: string, city: string): string | null {
  const parts = address.split(",").map(p => p.trim());
  for (const part of parts) {
    if (part.toLowerCase() === city.toLowerCase()) continue;
    if (/^\d{5}/.test(part)) continue;
    if (/\d/.test(part) && /[a-zäöüß]/i.test(part) && part.length > 3) {
      return part;
    }
  }
  return null;
}
