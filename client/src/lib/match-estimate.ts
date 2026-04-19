export function getMatchEstimateRange(rawEstimate: number): { low: number; high: number } {
  const raw = rawEstimate || 0;

  let adjusted = raw * 0.12;

  if (adjusted < 2) adjusted = 2;
  if (adjusted > 120) adjusted = 120;

  const low = Math.max(2, Math.round(adjusted * 0.7));
  const high = Math.round(adjusted * 1.3);

  return { low, high };
}

// ── Shared types (mirrored from server/match-estimate.ts) ────────────────────

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
  include_paid_sites?: boolean;
  include_housing_corporations?: boolean;
  include_lottery_housing?: boolean;
}

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

// ── Central filter normalizer ─────────────────────────────────────────────────
// Converts onboarding URLSearchParams into a NormalizedFilters object
// that can be sent to POST /api/match-estimate.
// This is the single source of truth for how onboarding state maps to filters.
export function normalizeOnboardingParams(params: URLSearchParams): NormalizedFilters {
  const city = params.get("city") || "";

  const rawLocationMode = params.get("locationMode") || "city";
  const location_mode: NormalizedFilters["location_mode"] =
    rawLocationMode === "radius" ? "radius"
    : rawLocationMode === "districts" ? "districts"
    : "city";

  const lat = parseFloat(params.get("lat") || "");
  const lng = parseFloat(params.get("lng") || "");
  const radiusKm = parseInt(params.get("radiusKm") || "");

  const rawDistricts = params.get("districts");
  const districts = rawDistricts
    ? rawDistricts.split(",").map((d) => d.trim()).filter(Boolean)
    : undefined;

  const price_min = parseInt(params.get("minPrice") || "") || 0;
  const price_max = parseInt(params.get("maxPrice") || "") || 0;
  const bedrooms_min = parseInt(params.get("minRooms") || "") || 0;
  const size_min = parseInt(params.get("minSize") || "") || 0;

  const rawFurnished = params.get("furnished") || "";
  const furnished =
    rawFurnished && rawFurnished !== "any" && rawFurnished !== "no_preference"
      ? rawFurnished
      : undefined;

  const rawPropertyTypes = params.get("propertyTypes");
  const property_types = rawPropertyTypes
    ? rawPropertyTypes.split(",").map((t) => t.trim()).filter(Boolean)
    : undefined;

  const rawAmenities = params.get("amenities");
  const extra_features = rawAmenities
    ? rawAmenities.split(",").map((a) => a.trim()).filter(Boolean)
    : undefined;

  const send_unclear = params.get("sendUnclear") !== "false";
  const price_flexible = params.get("priceFlexible") === "true";

  const include_paid_sites = params.get("includePaidSites") !== "false";
  const include_housing_corporations = params.get("includeHousingCorporations") !== "false";
  const include_lottery_housing = params.get("includeLotteryHousing") !== "false";

  return {
    city,
    city_name: params.get("searchName")?.trim() || city,
    location_mode,
    latitude: !isNaN(lat) ? lat : undefined,
    longitude: !isNaN(lng) ? lng : undefined,
    radius_km: !isNaN(radiusKm) && radiusKm > 0 ? radiusKm : undefined,
    districts: districts && districts.length > 0 ? districts : undefined,
    price_min,
    price_max,
    bedrooms_min,
    size_min,
    furnished,
    property_types: property_types && property_types.length > 0 ? property_types : undefined,
    extra_features: extra_features && extra_features.length > 0 ? extra_features : undefined,
    send_unclear,
    price_flexible,
    include_paid_sites,
    include_housing_corporations,
    include_lottery_housing,
  };
}

// ── Stable query key for useQuery ─────────────────────────────────────────────
export function matchEstimateQueryKey(filters: NormalizedFilters): unknown[] {
  return [
    "/api/match-estimate",
    filters.city,
    filters.location_mode,
    filters.latitude ?? null,
    filters.longitude ?? null,
    filters.radius_km ?? null,
    (filters.districts ?? []).join(","),
    filters.price_min,
    filters.price_max,
    filters.bedrooms_min,
    filters.size_min,
    filters.furnished ?? "",
    (filters.property_types ?? []).join(","),
    (filters.extra_features ?? []).join(","),
    filters.send_unclear,
    filters.price_flexible,
  ];
}

// ── POST fetch helper ─────────────────────────────────────────────────────────
export async function fetchMatchEstimate(
  filters: NormalizedFilters,
): Promise<MatchEstimateResult> {
  const res = await fetch("/api/match-estimate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(filters),
  });
  if (!res.ok) throw new Error(`match-estimate: ${res.status}`);
  return res.json();
}
