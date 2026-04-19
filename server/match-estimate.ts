import { explainMatchInternal } from "./matching/engine";
import { getSupabaseAdmin } from "./supabase-admin";

// ── Time constants ────────────────────────────────────────────────────────────
const ONE_MIN = 60 * 1000;
const TEN_MIN = 10 * ONE_MIN;
const ONE_HOUR = 60 * ONE_MIN;
const ONE_DAY = 24 * ONE_HOUR;

// ── Shared filter type (mirrors SearchProfile fields used by the engine) ──────
export interface NormalizedFilters {
  city: string;
  city_name?: string;
  location_mode: "city" | "radius" | "districts";
  latitude?: number;
  longitude?: number;
  radius_km?: number;
  districts?: string[];
  price_min: number;
  price_max: number;
  bedrooms_min: number;
  size_min: number;
  furnished?: string;
  property_types?: string[];
  extra_features?: string[];
  send_unclear: boolean;
  price_flexible: boolean;
  include_rooms?: boolean;
  // These fields are accepted for forward-compatibility but not yet filterable
  // in the listings table — they are treated as pass-through (no effect on count).
  include_paid_sites?: boolean;
  include_housing_corporations?: boolean;
  include_lottery_housing?: boolean;
}

// ── Result types ──────────────────────────────────────────────────────────────
export interface PreviewListingResult {
  id: string;
  price: number | null;
  size_m2: number | null;
  city: string | null;
  source: string | null;
  image_url: string | null;
  fresh_label: string;
}

export interface MatchEstimateResult {
  matchesLast30Days: number;
  matchesLast7Days: number;
  matchesToday: number;
  latestListingWithImage: PreviewListingResult | null;
  fallbackPreviewAvailable: boolean;
}

// ── In-memory TTL cache ───────────────────────────────────────────────────────
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const _cache = new Map<string, { ts: number; result: MatchEstimateResult }>();

function cacheKey(f: NormalizedFilters): string {
  return JSON.stringify({
    city: f.city.toLowerCase().trim(),
    lm: f.location_mode,
    lat: f.latitude ?? null,
    lng: f.longitude ?? null,
    rkm: f.radius_km ?? null,
    dist: (f.districts ?? []).slice().sort().join(","),
    pmin: f.price_min,
    pmax: f.price_max,
    bmin: f.bedrooms_min,
    smin: f.size_min,
    furn: f.furnished ?? "",
    ptypes: (f.property_types ?? []).slice().sort().join(","),
    feat: (f.extra_features ?? []).slice().sort().join(","),
    su: f.send_unclear,
    pf: f.price_flexible,
    ir: f.include_rooms ?? false,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function freshLabel(createdAt: string): string {
  const age = Date.now() - new Date(createdAt).getTime();
  if (age < TEN_MIN) return "net_binnen";
  if (age < ONE_HOUR) return "nieuw";
  if (age < ONE_DAY) return "vandaag";
  const days = Math.floor(age / ONE_DAY);
  return days === 1 ? "gisteren" : `${days} dagen geleden`;
}

const PLACEHOLDER_PATTERNS = [
  "placeholder", "no-image", "noimage", "default-listing",
  "missing", "dummy", "blank", "fallback",
];

function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const t = url.trim();
  if (!t || !/^https?:\/\//i.test(t)) return false;
  const lower = t.toLowerCase();
  return !PLACEHOLDER_PATTERNS.some((p) => lower.includes(p));
}

// ── DB fields to select from listings ────────────────────────────────────────
const LISTING_SELECT = [
  "id, source, title, city, price, bedrooms, size_m2, image_url, created_at",
  "furnished, district, pets_allowed, balcony, elevator, garden, bath",
  "roof_terrace, parking, energy_label, property_type, latitude, longitude",
  "extra_features, target_categories",
].join(", ");

// ── Main estimator ────────────────────────────────────────────────────────────
export async function computeMatchEstimate(
  filters: NormalizedFilters,
): Promise<MatchEstimateResult> {
  const key = cacheKey(filters);
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.result;

  const supabase = getSupabaseAdmin();
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * ONE_DAY).toISOString();
  const sevenDaysAgo = new Date(now - 7 * ONE_DAY).toISOString();
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  // Broad pre-filter in Supabase (refined in-memory by explainMatchInternal)
  let query = supabase
    .from("listings")
    .select(LISTING_SELECT)
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false })
    .limit(filters.location_mode === "radius" ? 2000 : 1000);

  // City pre-filter: skip for radius mode (lat/lng evaluated in-memory)
  if (filters.location_mode !== "radius" && filters.city) {
    query = query.ilike("city", `%${filters.city}%`);
  }

  // Broad price bounds (add slack so flexible profiles aren't over-excluded)
  if (filters.price_min > 0) {
    query = query.gte("price", Math.floor(filters.price_min * 0.85));
  }
  if (filters.price_max > 0) {
    query = query.lte("price", Math.ceil(filters.price_max * 1.2));
  }

  // Bedrooms lower bound pre-filter (listings with 0 bedrooms pass for hybrid)
  if (filters.bedrooms_min > 0) {
    query = query.or(`bedrooms.gte.${filters.bedrooms_min},bedrooms.eq.0`);
  }

  const { data, error } = await query;

  if (error || !data) {
    return {
      matchesLast30Days: 0,
      matchesLast7Days: 0,
      matchesToday: 0,
      latestListingWithImage: null,
      fallbackPreviewAvailable: false,
    };
  }

  // Build property_types for the profile:
  // if include_rooms=true, append "room" so room listings are counted too.
  let resolvedPropertyTypes: string[] | null = filters.property_types?.length
    ? [...filters.property_types]
    : null;
  if (filters.include_rooms) {
    if (resolvedPropertyTypes) {
      if (!resolvedPropertyTypes.includes("room")) resolvedPropertyTypes.push("room");
    }
    // If no specific property type was set, include_rooms alone doesn't restrict types
  }

  // Build a SearchProfile-shaped object for explainMatchInternal
  const profile = {
    id: "estimate",
    user_id: "estimate",
    city: filters.city,
    city_name: filters.city_name || filters.city,
    price_min: filters.price_min,
    price_max: filters.price_max,
    bedrooms_min: filters.bedrooms_min,
    size_min: filters.size_min,
    furnished: filters.furnished ?? null,
    extra_features: filters.extra_features?.length ? filters.extra_features : null,
    target_categories: null,
    districts: filters.districts?.length ? filters.districts : null,
    property_types: resolvedPropertyTypes,
    location_mode: filters.location_mode,
    latitude: filters.latitude ?? null,
    longitude: filters.longitude ?? null,
    radius_km: filters.radius_km ?? null,
    send_unclear: filters.send_unclear,
    price_flexible: filters.price_flexible,
    created_at: null,
  };

  let count30 = 0;
  let count7 = 0;
  let count0 = 0;
  let previewWithImage: PreviewListingResult | null = null;
  let previewFallback: PreviewListingResult | null = null;

  const excludeRooms =
    filters.include_rooms === false && !filters.property_types?.length;

  for (const listing of data) {
    const { matched } = explainMatchInternal(listing as any, profile as any);
    if (!matched) continue;

    if (excludeRooms) {
      const rawType = ((listing.property_type as string | null) ?? "").toLowerCase().trim();
      if (rawType === "room" || rawType === "zimmer" || rawType === "wg-zimmer") continue;
    }

    const createdAt = listing.created_at as string;
    count30++;
    if (createdAt >= sevenDaysAgo) count7++;
    if (createdAt >= todayStart) count0++;

    // Fallback order for preview: valid image first, then any listing
    if (!previewWithImage && isValidImageUrl(listing.image_url)) {
      previewWithImage = {
        id: listing.id,
        price: listing.price ?? null,
        size_m2: listing.size_m2 ?? null,
        city: listing.city ?? null,
        source: listing.source ?? null,
        image_url: listing.image_url,
        fresh_label: freshLabel(createdAt),
      };
    }
    if (!previewFallback) {
      previewFallback = {
        id: listing.id,
        price: listing.price ?? null,
        size_m2: listing.size_m2 ?? null,
        city: listing.city ?? null,
        source: listing.source ?? null,
        image_url: null,
        fresh_label: freshLabel(createdAt),
      };
    }

    // Short-circuit: once we have both a preview with image and a fallback,
    // and we have counted enough (say, 3 per time bucket is enough for display),
    // we can stop iterating to save time.
    if (previewWithImage && previewFallback && count30 >= 200) break;
  }

  const latestListingWithImage = previewWithImage ?? previewFallback;

  const result: MatchEstimateResult = {
    matchesLast30Days: count30,
    matchesLast7Days: count7,
    matchesToday: count0,
    latestListingWithImage,
    fallbackPreviewAvailable: previewFallback !== null,
  };

  _cache.set(key, { ts: Date.now(), result });
  return result;
}
