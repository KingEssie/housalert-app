import { createClient } from "@supabase/supabase-js";
import { bufferMatchAlert } from "../notifications/buffer";
import { trackMatchCreated } from "../freshness";
import { getSubscriptionStatus } from "../subscriptions";
import { upsertUserMatch, markEmailSent, markPushSent } from "../user-matches";
import { getListingStatus, isListingMatchable, type ListingStatus } from "../listing-status";
import { trackEvent as trackActivationEvent, hasEvent as hasActivationEvent } from "../activation-events";

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface SearchProfile {
  id: string;
  user_id: string;
  city: string;
  city_name?: string;
  price_min: number;
  price_max: number;
  bedrooms_min: number;
  size_min: number;
  furnished?: string | null;
  extra_features?: string[] | null;
  target_categories?: string[] | null;
  districts?: string[] | null;
  property_types?: string[] | null;
  location_mode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radius_km?: number | null;
  send_unclear?: boolean | null;
  price_flexible?: boolean | null;
}

interface DbListing {
  id: string;
  source: string;
  url: string | null;
  title: string;
  city: string;
  price: number;
  bedrooms: number;
  size_m2: number;
  image_url?: string | null;
  furnished?: boolean | null;
  pets_allowed?: boolean | null;
  balcony?: boolean | null;
  elevator?: boolean | null;
  garden?: boolean | null;
  bath?: boolean | null;
  roof_terrace?: boolean | null;
  parking?: boolean | null;
  energy_label?: string | null;
  property_type?: string | null;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  extra_features?: string[] | null;
  target_categories?: string[] | null;
  coordinate_source?: string | null;
  coordinate_precision?: string | null;
  created_at?: string | null;
}



let hasFurnishedColumn: boolean | null = null;
let hasDistrictColumn: boolean | null = null;
let hasAdvancedListingColumns: boolean | null = null;

async function checkFurnishedColumn(): Promise<boolean> {
  if (hasFurnishedColumn !== null) return hasFurnishedColumn;
  const { error } = await supabase.from("listings").select("furnished").limit(1);
  hasFurnishedColumn = !error;
  return hasFurnishedColumn;
}

async function checkDistrictColumn(): Promise<boolean> {
  if (hasDistrictColumn !== null) return hasDistrictColumn;
  const { error } = await supabase.from("listings").select("district").limit(1);
  hasDistrictColumn = !error;
  return hasDistrictColumn;
}

async function checkAdvancedListingColumns(): Promise<boolean> {
  if (hasAdvancedListingColumns !== null) return hasAdvancedListingColumns;
  const { error } = await supabase.from("listings").select("pets_allowed, balcony, elevator").limit(1);
  hasAdvancedListingColumns = !error;
  return hasAdvancedListingColumns;
}

function getListingSelect(): string {
  const base = "id, source, url, title, city, price, bedrooms, size_m2, image_url, created_at";
  const parts = [base];
  if (hasFurnishedColumn !== false) parts.push("furnished");
  if (hasDistrictColumn !== false) parts.push("district");
  if (hasAdvancedListingColumns !== false) parts.push("pets_allowed, balcony, elevator, garden, bath, roof_terrace, parking, energy_label, property_type, latitude, longitude, extra_features, target_categories");
  return parts.join(", ");
}

export interface FilterCheck {
  filter: string;
  profileField: string;
  profileValue: string;
  listingField: string;
  listingValue: string;
  rule: string;
  passed: boolean;
  hybridPass?: boolean;
  skipped?: boolean;
  unsupported?: boolean;
}

export interface MatchExplanation {
  matched: boolean;
  checks: FilterCheck[];
  reason: string;
}

const SUPPORTED_FEATURES = new Set([
  "pets_allowed", "huisdieren",
  "balcony", "balkon",
  "elevator", "lift",
  "garden", "tuin",
  "bath", "bad", "badewanne",
  "roof_terrace", "rooftop", "dakterras", "dachterrasse",
]);

const UNSUPPORTED_FEATURES = new Set([
  "basement", "kelder",
]);

function mapExtraFeatureToListingField(feature: string, listing: DbListing): { value: boolean | null; fieldName: string; supported: boolean } {
  switch (feature) {
    case "pets_allowed":
    case "huisdieren": return { value: listing.pets_allowed ?? null, fieldName: "pets_allowed", supported: true };
    case "balcony":
    case "balkon": return { value: listing.balcony ?? null, fieldName: "balcony", supported: true };
    case "elevator":
    case "lift": return { value: listing.elevator ?? null, fieldName: "elevator", supported: true };
    case "garden":
    case "tuin": return { value: listing.garden ?? null, fieldName: "garden", supported: true };
    case "bath":
    case "bad":
    case "badewanne": return { value: listing.bath ?? null, fieldName: "bath", supported: true };
    case "roof_terrace":
    case "rooftop":
    case "dakterras":
    case "dachterrasse": return { value: listing.roof_terrace ?? null, fieldName: "roof_terrace", supported: true };
    case "parking":
    case "parkeerplaats":
    case "stellplatz":
    case "parkplatz":
    case "garage":
    case "tiefgarage": return { value: listing.parking ?? null, fieldName: "parking", supported: true };
    default: return { value: null, fieldName: feature, supported: false };
  }
}

const ENERGY_LABEL_ORDER: Record<string, number> = {
  "A+": 1, "A": 2, "B": 3, "C": 4, "D": 5, "E": 6, "F": 7, "G": 8, "H": 9,
};

function energyLabelMeetsMinimum(listingLabel: string, requiredLabel: string): boolean {
  const listingRank = ENERGY_LABEL_ORDER[listingLabel.toUpperCase()];
  const requiredRank = ENERGY_LABEL_ORDER[requiredLabel.toUpperCase()];
  if (!listingRank || !requiredRank) return false;
  return listingRank <= requiredRank;
}

const PROPERTY_TYPE_ALIASES: Record<string, string> = {
  "wohnung": "apartment",
  "flat": "apartment",
  "etagenwohnung": "apartment",
  "haus": "house",
  "villa": "house",
  "bungalow": "house",
  "einzimmerwohnung": "studio",
  "zimmer": "room",
  "wg-zimmer": "room",
  "wg": "shared",
  "wohngemeinschaft": "shared",
  "maisonettewohnung": "maisonette",
};

function normalizePropertyTypeForMatch(raw: string): string {
  const lower = raw.toLowerCase().trim();
  return PROPERTY_TYPE_ALIASES[lower] || lower;
}

function evaluateOptionalBooleanFilter(
  listingValue: boolean | null,
  sendUnclear: boolean,
  filterName: string,
  fieldName: string,
): { passed: boolean; hybridPass: boolean; rule: string } {
  if (listingValue === true) {
    return { passed: true, hybridPass: false, rule: `${filterName}: listing.${fieldName}=true → pass` };
  }
  if (listingValue === false) {
    return { passed: false, hybridPass: false, rule: `${filterName}: listing.${fieldName}=false → known mismatch → reject` };
  }
  if (sendUnclear) {
    return { passed: true, hybridPass: true, rule: `${filterName}: listing.${fieldName}=null (unknown) + send_unclear=ON → allowed` };
  }
  return { passed: false, hybridPass: false, rule: `${filterName}: listing.${fieldName}=null (unknown) + send_unclear=OFF → reject` };
}

const GERMAN_CITY_ALIASES: Record<string, string[]> = {
  "münchen": ["munich", "muenchen"],
  "köln": ["cologne", "koeln"],
  "düsseldorf": ["duesseldorf"],
  "nürnberg": ["nuremberg", "nuernberg"],
  "zürich": ["zurich", "zuerich"],
  "würzburg": ["wuerzburg"],
  "göttingen": ["goettingen"],
  "lübeck": ["luebeck"],
  "saarbrücken": ["saarbruecken"],
  "braunschweig": ["brunswick"],
  "hannover": ["hanover"],
  "frankfurt am main": ["frankfurt"],
  "freiburg im breisgau": ["freiburg"],
};

export function normalizeCity(raw: string): string {
  return raw.toLowerCase().trim().replace(/\s+/g, " ");
}

function resolveAliases(city: string): string[] {
  const result = [city];
  for (const [canonical, aliases] of Object.entries(GERMAN_CITY_ALIASES)) {
    if (city === canonical) {
      result.push(...aliases);
    } else if (aliases.includes(city)) {
      result.push(canonical);
      result.push(...aliases.filter(x => x !== city));
    }
  }
  return result;
}

export function getCitySearchTerms(city: string): string[] {
  const normalized = normalizeCity(city);
  if (!normalized) return [];
  const all = resolveAliases(normalized);
  return [...new Set(all.map(c => c.replace(/[%_\\,()]/g, "")))].filter(c => c.length >= 3);
}

export function citiesMatch(listingCity: string, profileCity: string): boolean {
  const a = normalizeCity(listingCity);
  const b = normalizeCity(profileCity);

  if (!a || !b) return false;

  if (a === b) return true;

  if (a.startsWith(b + " ") || b.startsWith(a + " ")) return true;

  const aliasesA = resolveAliases(a);
  const aliasesB = resolveAliases(b);

  for (const ca of aliasesA) {
    for (const cb of aliasesB) {
      if (ca === cb) return true;
    }
  }

  return false;
}

export function haversineDistanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const toRad = (deg: number) => deg * (Math.PI / 180);
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function explainMatchInternal(listing: DbListing, profile: SearchProfile): MatchExplanation {
  const checks: FilterCheck[] = [];
  const sendUnclear = profile.send_unclear !== false;
  const priceFlexible = profile.price_flexible === true;

  const listingCity = normalizeCity(listing.city);
  const profileCity = normalizeCity(profile.city_name || profile.city || "");
  const isRadiusMode = profile.location_mode === "radius";

  if (isRadiusMode) {
    const profileLat = profile.latitude ?? null;
    const profileLng = profile.longitude ?? null;
    const radiusKm = profile.radius_km ?? null;

    if (profileLat == null || profileLng == null || radiusKm == null || radiusKm <= 0) {
      checks.push({
        filter: "radius",
        profileField: "latitude/longitude/radius_km",
        profileValue: `lat=${profileLat}, lng=${profileLng}, radius=${radiusKm}km`,
        listingField: "latitude/longitude",
        listingValue: `lat=${listing.latitude}, lng=${listing.longitude}`,
        rule: "radius mode active but profile center coordinates or radius_km missing/invalid → cannot evaluate → reject",
        passed: false,
      });
      return { matched: false, checks, reason: `Radius mode active but profile missing center coordinates or radius_km (lat=${profileLat}, lng=${profileLng}, radius=${radiusKm})` };
    }

    const listingLat = listing.latitude ?? null;
    const listingLng = listing.longitude ?? null;

    if (listingLat == null || listingLng == null) {
      checks.push({
        filter: "radius",
        profileField: "latitude/longitude/radius_km",
        profileValue: `center=(${profileLat}, ${profileLng}), radius=${radiusKm}km`,
        listingField: "latitude/longitude",
        listingValue: `lat=${listingLat}, lng=${listingLng}`,
        rule: "radius mode active but listing has no coordinates → not radius-matchable → reject (send_unclear does NOT override missing geo)",
        passed: false,
      });
      return { matched: false, checks, reason: `Radius mode: listing has no coordinates (lat=${listingLat}, lng=${listingLng}) — cannot compute distance` };
    }

    const distanceKm = haversineDistanceKm(profileLat, profileLng, listingLat, listingLng);
    const radiusPassed = distanceKm <= radiusKm;

    checks.push({
      filter: "radius",
      profileField: "latitude/longitude/radius_km",
      profileValue: `center=(${profileLat}, ${profileLng}), radius=${radiusKm}km`,
      listingField: "latitude/longitude",
      listingValue: `(${listingLat}, ${listingLng}), distance=${distanceKm.toFixed(2)}km`,
      rule: radiusPassed
        ? `distance ${distanceKm.toFixed(2)}km <= radius ${radiusKm}km → pass`
        : `distance ${distanceKm.toFixed(2)}km > radius ${radiusKm}km → reject`,
      passed: radiusPassed,
    });
    if (!radiusPassed) {
      return { matched: false, checks, reason: `Radius: distance ${distanceKm.toFixed(2)}km > radius ${radiusKm}km` };
    }
  } else {
    const cityPassed = citiesMatch(listingCity, profileCity);
    checks.push({
      filter: "city",
      profileField: "city_name || city",
      profileValue: profileCity || "(empty)",
      listingField: "city",
      listingValue: listingCity,
      rule: "exact match or alias match (case-insensitive, German aliases supported)",
      passed: cityPassed,
    });
    if (!cityPassed) return { matched: false, checks, reason: `City mismatch: listing="${listingCity}" vs profile="${profileCity}"` };
  }

  const listingPriceKnown = listing.price > 0;
  let priceMinPassed: boolean;
  let priceMinHybrid = false;
  if (profile.price_min <= 0) {
    priceMinPassed = true;
  } else if (!listingPriceKnown) {
    priceMinPassed = true;
    priceMinHybrid = true;
  } else {
    priceMinPassed = listing.price >= profile.price_min;
  }
  checks.push({
    filter: "price_min",
    profileField: "price_min",
    profileValue: String(profile.price_min),
    listingField: "price",
    listingValue: String(listing.price),
    rule: listingPriceKnown
      ? "listing.price >= profile.price_min (skipped if price_min=0)"
      : "hybrid: listing.price=0 (unknown) → allowed",
    passed: priceMinPassed,
    hybridPass: priceMinHybrid,
  });
  if (!priceMinPassed) return { matched: false, checks, reason: `Price ${listing.price} < min ${profile.price_min}` };

  let priceMaxPassed: boolean;
  let priceMaxHybrid = false;
  if (profile.price_max <= 0) {
    priceMaxPassed = true;
  } else if (!listingPriceKnown) {
    priceMaxPassed = true;
    priceMaxHybrid = true;
  } else {
    const effectiveMax = priceFlexible
      ? Math.round(profile.price_max * 1.10)
      : profile.price_max;
    priceMaxPassed = listing.price <= effectiveMax;
  }
  checks.push({
    filter: "price_max",
    profileField: "price_max",
    profileValue: String(profile.price_max),
    listingField: "price",
    listingValue: String(listing.price),
    rule: listingPriceKnown
      ? priceFlexible
        ? `listing.price <= profile.price_max * 1.10 (${Math.round(profile.price_max * 1.10)}€, price_flexible=ON)`
        : "listing.price <= profile.price_max (skipped if price_max=0)"
      : "hybrid: listing.price=0 (unknown) → allowed",
    passed: priceMaxPassed,
    hybridPass: priceMaxHybrid,
  });
  if (!priceMaxPassed) return { matched: false, checks, reason: `Price ${listing.price} > max ${priceFlexible ? Math.round(profile.price_max * 1.10) : profile.price_max}${priceFlexible ? " (flexible +10%)" : ""}` };

  const listingBedsKnown = listing.bedrooms > 0;
  let bedroomsPassed: boolean;
  let bedroomsHybrid = false;
  if (profile.bedrooms_min <= 0) {
    bedroomsPassed = true;
  } else if (!listingBedsKnown) {
    bedroomsPassed = true;
    bedroomsHybrid = true;
  } else {
    bedroomsPassed = listing.bedrooms >= profile.bedrooms_min;
  }
  checks.push({
    filter: "bedrooms_min",
    profileField: "bedrooms_min",
    profileValue: String(profile.bedrooms_min),
    listingField: "bedrooms",
    listingValue: String(listing.bedrooms),
    rule: listingBedsKnown
      ? "listing.bedrooms >= profile.bedrooms_min (skipped if bedrooms_min=0)"
      : "hybrid: listing.bedrooms=0 (unknown) → allowed",
    passed: bedroomsPassed,
    hybridPass: bedroomsHybrid,
  });
  if (!bedroomsPassed) return { matched: false, checks, reason: `Bedrooms ${listing.bedrooms} < min ${profile.bedrooms_min}` };

  const listingSizeKnown = listing.size_m2 > 0;
  let sizePassed: boolean;
  let sizeHybrid = false;
  if (profile.size_min <= 0) {
    sizePassed = true;
  } else if (!listingSizeKnown) {
    sizePassed = true;
    sizeHybrid = true;
  } else {
    sizePassed = listing.size_m2 >= profile.size_min;
  }
  checks.push({
    filter: "size_min",
    profileField: "size_min",
    profileValue: String(profile.size_min),
    listingField: "size_m2",
    listingValue: String(listing.size_m2),
    rule: listingSizeKnown
      ? "listing.size_m2 >= profile.size_min (skipped if size_min=0)"
      : "hybrid: listing.size_m2=0 (unknown) → allowed",
    passed: sizePassed,
    hybridPass: sizeHybrid,
  });
  if (!sizePassed) return { matched: false, checks, reason: `Size ${listing.size_m2}m² < min ${profile.size_min}m²` };

  if (profile.furnished && profile.furnished !== "any" && profile.furnished !== "no_preference") {
    const listingFurnished = listing.furnished ?? null;
    const wantsFurnished = profile.furnished === "furnished";
    const expectedValue = wantsFurnished;
    let furnishedPassed: boolean;
    let isHybridPass = false;
    let rule: string;
    if (listingFurnished === null) {
      if (sendUnclear) {
        furnishedPassed = true;
        isHybridPass = true;
        rule = `furnished: listing.furnished=null (unknown) + send_unclear=ON → allowed`;
      } else {
        furnishedPassed = false;
        rule = `furnished: listing.furnished=null (unknown) + send_unclear=OFF → reject`;
      }
    } else {
      furnishedPassed = listingFurnished === expectedValue;
      rule = `furnished: listing.furnished=${listingFurnished}, profile wants ${profile.furnished} → ${furnishedPassed ? "pass" : "known mismatch → reject"}`;
    }
    checks.push({
      filter: "furnished",
      profileField: "furnished",
      profileValue: profile.furnished,
      listingField: "furnished",
      listingValue: String(listingFurnished),
      rule,
      passed: furnishedPassed,
      hybridPass: isHybridPass,
    });
    if (!furnishedPassed) {
      return { matched: false, checks, reason: `Furnished filter: profile=${profile.furnished} but listing.furnished=${listingFurnished}` };
    }
  }

  if (profile.extra_features && profile.extra_features.length > 0) {
    for (const feature of profile.extra_features) {
      const { value, fieldName, supported } = mapExtraFeatureToListingField(feature, listing);

      if (!supported) {
        checks.push({
          filter: `extra_feature:${feature}`,
          profileField: "extra_features",
          profileValue: feature,
          listingField: fieldName,
          listingValue: "(no DB column)",
          rule: `unsupported: no backend data exists for "${feature}" — skipping filter (not blocking match)`,
          passed: true,
          skipped: true,
          unsupported: true,
        });
        continue;
      }

      const result = evaluateOptionalBooleanFilter(value, sendUnclear, feature, fieldName);
      checks.push({
        filter: `extra_feature:${feature}`,
        profileField: "extra_features",
        profileValue: feature,
        listingField: fieldName,
        listingValue: String(value),
        rule: result.rule,
        passed: result.passed,
        hybridPass: result.hybridPass,
      });
      if (!result.passed) {
        return { matched: false, checks, reason: `Feature "${feature}" required but listing.${fieldName}=${value}${!sendUnclear && value === null ? " (send_unclear=OFF)" : ""}` };
      }
    }
  }

  if (profile.property_types && profile.property_types.length > 0) {
    const listingType = listing.property_type ? normalizePropertyTypeForMatch(listing.property_type) : null;
    const profileTypes = profile.property_types.map(t => normalizePropertyTypeForMatch(t));
    let ptPassed: boolean;
    let ptHybrid = false;
    let ptRule: string;
    if (listingType === null) {
      if (sendUnclear) {
        ptPassed = true;
        ptHybrid = true;
        ptRule = `property_type: listing.property_type=null (unknown) + send_unclear=ON → allowed`;
      } else {
        ptPassed = false;
        ptRule = `property_type: listing.property_type=null (unknown) + send_unclear=OFF → reject`;
      }
    } else {
      ptPassed = profileTypes.includes(listingType);
      ptRule = ptPassed
        ? `property_type: listing="${listingType}" matches profile types → pass`
        : `property_type: listing="${listingType}" not in profile types [${profileTypes.join(",")}] → known mismatch → reject`;
    }
    checks.push({
      filter: "property_type",
      profileField: "property_types",
      profileValue: JSON.stringify(profile.property_types),
      listingField: "property_type",
      listingValue: listingType ?? "(null)",
      rule: ptRule,
      passed: ptPassed,
      hybridPass: ptHybrid,
    });
    if (!ptPassed) {
      return { matched: false, checks, reason: `Property type "${listingType}" not in profile types ${JSON.stringify(profile.property_types)}` };
    }
  }

  if (profile.target_categories && profile.target_categories.length > 0) {
    const listingCats = listing.target_categories ?? null;
    let tcPassed: boolean;
    let tcHybrid = false;
    let tcRule: string;
    if (!listingCats || listingCats.length === 0) {
      if (sendUnclear) {
        tcPassed = true;
        tcHybrid = true;
        tcRule = `target_categories: listing has no categories (unknown) + send_unclear=ON → allowed`;
      } else {
        tcPassed = false;
        tcRule = `target_categories: listing has no categories (unknown) + send_unclear=OFF → reject`;
      }
    } else {
      const profileCatsLower = profile.target_categories.map(c => c.toLowerCase().trim());
      const listingCatsLower = listingCats.map(c => c.toLowerCase().trim());
      tcPassed = profileCatsLower.some(pc => listingCatsLower.includes(pc));
      tcRule = tcPassed
        ? `target_categories: listing categories overlap with profile → pass`
        : `target_categories: listing [${listingCatsLower.join(",")}] has no overlap with profile [${profileCatsLower.join(",")}] → known mismatch → reject`;
    }
    checks.push({
      filter: "target_categories",
      profileField: "target_categories",
      profileValue: JSON.stringify(profile.target_categories),
      listingField: "target_categories",
      listingValue: JSON.stringify(listingCats),
      rule: tcRule,
      passed: tcPassed,
      hybridPass: tcHybrid,
    });
    if (!tcPassed) {
      return { matched: false, checks, reason: `Target categories mismatch: listing=${JSON.stringify(listingCats)} vs profile=${JSON.stringify(profile.target_categories)}` };
    }
  }

  const energyFeature = profile.extra_features?.find(f =>
    f === "energy_c" || f === "energielabel" || f.startsWith("energy_")
  );
  if (energyFeature) {
    const requiredLabel = energyFeature === "energy_c" || energyFeature === "energielabel" ? "C" : energyFeature.replace("energy_", "").toUpperCase();
    const listingLabel = listing.energy_label ?? null;
    let ePassed: boolean;
    let eHybrid = false;
    let eRule: string;
    if (listingLabel === null) {
      if (sendUnclear) {
        ePassed = true;
        eHybrid = true;
        eRule = `energy_label: listing.energy_label=null (unknown) + send_unclear=ON → allowed`;
      } else {
        ePassed = false;
        eRule = `energy_label: listing.energy_label=null (unknown) + send_unclear=OFF → reject`;
      }
    } else {
      ePassed = energyLabelMeetsMinimum(listingLabel, requiredLabel);
      eRule = ePassed
        ? `energy_label: listing="${listingLabel}" meets requirement "${requiredLabel} or better" → pass`
        : `energy_label: listing="${listingLabel}" worse than required "${requiredLabel}" → known mismatch → reject`;
    }
    checks.push({
      filter: "energy_label",
      profileField: "extra_features",
      profileValue: energyFeature,
      listingField: "energy_label",
      listingValue: listingLabel ?? "(null)",
      rule: eRule,
      passed: ePassed,
      hybridPass: eHybrid,
    });
    if (!ePassed) {
      return { matched: false, checks, reason: `Energy label "${listingLabel}" does not meet requirement "${requiredLabel} or better"` };
    }
  }

  const districtFilterActive = profile.districts && profile.districts.length > 0 &&
    (!profile.location_mode || profile.location_mode === "districts");

  if (districtFilterActive) {
    const listingDistrict = (listing.district ?? "").toLowerCase().trim();
    let districtPassed: boolean;
    let isHybridPass = false;
    let rule: string;
    if (!listingDistrict) {
      if (sendUnclear) {
        districtPassed = true;
        isHybridPass = true;
        rule = "district: listing.district=null (unknown) + send_unclear=ON → allowed";
      } else {
        districtPassed = false;
        rule = "district: listing.district=null (unknown) + send_unclear=OFF → reject";
      }
    } else {
      districtPassed = profile.districts!.some(d =>
        listingDistrict.includes(d.toLowerCase().trim()) ||
        d.toLowerCase().trim().includes(listingDistrict)
      );
      rule = districtPassed
        ? "district: listing.district matches profile districts → pass"
        : "district: listing.district does NOT match profile districts → reject";
    }
    checks.push({
      filter: "district",
      profileField: "districts",
      profileValue: JSON.stringify(profile.districts),
      listingField: "district",
      listingValue: listing.district ?? "(null)",
      rule,
      passed: districtPassed,
      hybridPass: isHybridPass,
    });
    if (!districtPassed) {
      return { matched: false, checks, reason: `District "${listing.district}" not in profile districts ${JSON.stringify(profile.districts)}` };
    }
  }

  return { matched: true, checks, reason: "All active filters passed" };
}

function doesListingMatchProfile(listing: DbListing, profile: SearchProfile): boolean {
  return explainMatchInternal(listing, profile).matched;
}

export async function explainMatch(
  listingId: string,
  profileId: string
): Promise<MatchExplanation & { listing?: DbListing; profile?: SearchProfile }> {
  await checkFurnishedColumn();
  await checkDistrictColumn();
  await checkAdvancedListingColumns();

  const { data: listing } = await supabase
    .from("listings")
    .select(getListingSelect())
    .eq("id", listingId)
    .single();

  const { data: profile } = await supabase
    .from("search_profiles")
    .select("*")
    .eq("id", profileId)
    .single();

  if (!listing || !profile) {
    return {
      matched: false,
      checks: [],
      reason: !listing ? "Listing not found" : "Profile not found",
    };
  }

  const explanation = explainMatchInternal(listing as DbListing, profile as SearchProfile);
  return {
    ...explanation,
    listing: listing as DbListing,
    profile: profile as SearchProfile,
  };
}

export async function explainAllProfilesForListing(
  listingId: string
): Promise<{ listing: DbListing | null; results: Array<{ profileId: string; city: string; matched: boolean; reason: string; checks: FilterCheck[] }> }> {
  await checkFurnishedColumn();
  await checkDistrictColumn();
  await checkAdvancedListingColumns();

  const { data: listing } = await supabase
    .from("listings")
    .select(getListingSelect())
    .eq("id", listingId)
    .single();

  if (!listing) return { listing: null, results: [] };

  const { data: profiles } = await supabase.from("search_profiles").select("*");
  if (!profiles) return { listing: listing as DbListing, results: [] };

  const results = profiles.map((p: any) => {
    const sp = p as SearchProfile;
    const explanation = explainMatchInternal(listing as DbListing, sp);
    return {
      profileId: sp.id,
      city: sp.city_name || sp.city,
      matched: explanation.matched,
      reason: explanation.reason,
      checks: explanation.checks,
    };
  });

  return { listing: listing as DbListing, results };
}

function log(msg: string) {
  const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
  console.log(`${ts} [match-engine] ${msg}`);
}

async function insertMatchIfNew(
  userId: string,
  searchProfileId: string,
  listingId: string,
  listing?: DbListing | null
): Promise<{ created: false } | { created: true; matched_at: string }> {
  const { data: existing } = await supabase
    .from("matches")
    .select("id")
    .eq("user_id", userId)
    .eq("search_profile_id", searchProfileId)
    .eq("listing_id", listingId)
    .maybeSingle();

  if (existing) {
    log(`[MATCH SKIPPED DUPLICATE] user=${userId} profile=${searchProfileId} listing=${listingId}`);
    return { created: false };
  }

  const { data: matchRow, error: mErr } = await supabase
    .from("matches")
    .insert({
      user_id: userId,
      search_profile_id: searchProfileId,
      listing_id: listingId,
    })
    .select("id, created_at")
    .single();

  if (mErr) {
    if (mErr.code === "23505") {
      log(`[MATCH SKIPPED DUPLICATE] user=${userId} profile=${searchProfileId} listing=${listingId}`);
      return { created: false };
    }
    log(`[MATCH ERROR] ${mErr.message}`);
    return { created: false };
  }

  log(`[MATCH CREATED] id=${matchRow.id} user=${userId} profile=${searchProfileId} listing=${listingId}`);
  trackMatchCreated(matchRow.id).catch(() => {});

  hasActivationEvent(userId, "match_received").then(alreadyHas => {
    if (!alreadyHas) {
      trackActivationEvent(userId, "match_received", { listingId, matchId: matchRow.id }).catch(() => {});
    }
  }).catch(() => {});

  hasActivationEvent(userId, "first_match_received").then(alreadyHas => {
    if (!alreadyHas) {
      trackActivationEvent(userId, "first_match_received", { listingId, matchId: matchRow.id, city: listing?.city }).catch(() => {});
    }
  }).catch(() => {});

  try {
    await upsertUserMatch({
      user_id: userId,
      listing_id: listingId,
      search_profile_id: searchProfileId,
      listing_title: listing?.title,
      listing_city: listing?.city,
      listing_price: listing?.price,
      listing_source: listing?.source,
      listing_url: listing?.url,
      dedup_key: listing ? `${listing.source}:${listingId}` : undefined,
      matched_at: matchRow.created_at,
    });
  } catch (e: any) {
    log(`[MATCH ENGINE] user_matches upsert failed (non-blocking): ${e.message}`);
  }

  return { created: true, matched_at: matchRow.created_at };
}

export async function matchListingAgainstProfiles(listingId: string): Promise<number> {
  const matchStartMs = Date.now();
  log(`[MATCH ENGINE START] matchListingAgainstProfiles listing=${listingId}`);

  await checkFurnishedColumn();
  await checkDistrictColumn();
  await checkAdvancedListingColumns();

  const { data: listing, error: lErr } = await supabase
    .from("listings")
    .select(getListingSelect())
    .eq("id", listingId)
    .single();

  if (lErr || !listing) {
    log(`[MATCH ENGINE COMPLETE] listing not found, 0 matches`);
    return 0;
  }

  const listingStatus = await getListingStatus(listingId);
  if (listingStatus && !isListingMatchable(listingStatus)) {
    log(`[MATCH ENGINE COMPLETE] listing=${listingId} status="${listingStatus}" — skipping non-active listing`);
    return 0;
  }

  const searchTerms = getCitySearchTerms((listing as DbListing).city);
  let profiles: any[] | null = null;
  let pErr: any = null;

  if (searchTerms.length > 0) {
    const cityFilter = searchTerms.map(t => `city.ilike.%${t}%,city_name.ilike.%${t}%`).join(",");
    const orFilter = `${cityFilter},location_mode.eq.radius`;
    const result = await supabase
      .from("search_profiles")
      .select("*")
      .or(orFilter);
    profiles = result.data;
    pErr = result.error;
    if (pErr) {
      log(`[MATCH ENGINE] City-filtered query failed, falling back to full scan: ${pErr.message}`);
      const fallback = await supabase.from("search_profiles").select("*");
      profiles = fallback.data;
      pErr = fallback.error;
    }
  } else {
    const result = await supabase.from("search_profiles").select("*");
    profiles = result.data;
    pErr = result.error;
  }

  if (pErr || !profiles || profiles.length === 0) {
    log(`[MATCH ENGINE COMPLETE] no profiles found for city="${(listing as DbListing).city}", 0 matches`);
    return 0;
  }

  let totalMatches = 0;
  const resolvedEmails = new Map<string, string>();
  const userSubCache = new Map<string, { hasAccess: boolean }>();

  for (const profile of profiles as SearchProfile[]) {
    if (!doesListingMatchProfile(listing as DbListing, profile)) continue;

    const result = await insertMatchIfNew(profile.user_id, profile.id, listing.id, listing as DbListing);
    if (!result.created) continue;

    totalMatches++;

    if (!userSubCache.has(profile.user_id)) {
      const subStatus = await getSubscriptionStatus(profile.user_id);
      userSubCache.set(profile.user_id, { hasAccess: subStatus.isActive || subStatus.isTrial });
    }

    if (!userSubCache.get(profile.user_id)!.hasAccess) {
      log(`[MATCH ENGINE] Skipping alert buffer for user ${profile.user_id.substring(0, 8)}... — no active subscription`);
      continue;
    }

    if (!resolvedEmails.has(profile.user_id)) {
      const { data: userData } = await supabase.auth.admin.getUserById(profile.user_id);
      resolvedEmails.set(profile.user_id, userData?.user?.email ?? "");
    }

    const email = resolvedEmails.get(profile.user_id);
    if (email) {
      const l = listing as DbListing;
      bufferMatchAlert(profile.user_id, email, {
        listing_id: l.id,
        title: l.title,
        city: l.city,
        price: l.price,
        bedrooms: l.bedrooms,
        size_m2: l.size_m2,
        url: l.url,
        image_url: l.image_url,
        matched_at: result.matched_at,
      });
    }
  }

  const matchDurationMs = Date.now() - matchStartMs;
  log(`[MATCH ENGINE COMPLETE] listing=${listingId} matches=${totalMatches} [${matchDurationMs}ms]`);
  return totalMatches;
}

export async function backfillMatchesForSearchProfile(searchProfileId: string): Promise<number> {
  log(`[MATCH ENGINE START] backfillMatchesForSearchProfile profile=${searchProfileId}`);

  await checkFurnishedColumn();
  await checkDistrictColumn();
  await checkAdvancedListingColumns();

  const { data: profile, error: pErr } = await supabase
    .from("search_profiles")
    .select("*")
    .eq("id", searchProfileId)
    .single();

  if (pErr || !profile) {
    log(`[MATCH ENGINE COMPLETE] profile not found, 0 matches`);
    return 0;
  }

  const sp = profile as SearchProfile;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const profileCityRaw = sp.city_name || sp.city || "";
  const backfillSearchTerms = getCitySearchTerms(profileCityRaw);

  let listings: any[] | null = null;
  let lErr: any = null;

  if (backfillSearchTerms.length > 0) {
    const orFilter = backfillSearchTerms.map(t => `city.ilike.%${t}%`).join(",");
    const result = await supabase
      .from("listings")
      .select(getListingSelect())
      .gte("created_at", sevenDaysAgo)
      .or(orFilter);
    listings = result.data;
    lErr = result.error;
    if (lErr) {
      log(`[MATCH ENGINE] City-filtered listing query failed, falling back to full scan: ${lErr.message}`);
      const fallback = await supabase.from("listings").select(getListingSelect()).gte("created_at", sevenDaysAgo);
      listings = fallback.data;
      lErr = fallback.error;
    } else {
      log(`[MATCH ENGINE] Backfill pre-filtered to ${listings?.length ?? 0} listings in city="${profileCityRaw}"`);
    }
  } else {
    const result = await supabase.from("listings").select(getListingSelect()).gte("created_at", sevenDaysAgo);
    listings = result.data;
    lErr = result.error;
  }

  if (lErr || !listings || listings.length === 0) {
    log(`[MATCH ENGINE COMPLETE] no recent listings found for city="${profileCityRaw}", 0 matches`);
    return 0;
  }

  const { getListingStatusBatch: batchStatus } = await import("../listing-status");
  const allIds = (listings as DbListing[]).map(l => l.id);
  const statusMap = await batchStatus(allIds);

  let totalMatches = 0;
  let skippedStale = 0;
  const matchedEntries: { listing: DbListing; matched_at: string }[] = [];

  for (const listing of listings as DbListing[]) {
    const lStatus = statusMap[listing.id] ?? "active";
    if (!isListingMatchable(lStatus)) {
      skippedStale++;
      continue;
    }

    if (!doesListingMatchProfile(listing, sp)) continue;

    const result = await insertMatchIfNew(sp.user_id, sp.id, listing.id, listing);
    if (result.created) {
      totalMatches++;
      matchedEntries.push({ listing, matched_at: result.matched_at });
    }
  }

  if (skippedStale > 0) {
    log(`[MATCH ENGINE] Backfill skipped ${skippedStale} stale/removed listings`);
  }

  if (matchedEntries.length > 0) {
    const subStatus = await getSubscriptionStatus(sp.user_id);
    if (subStatus.isActive || subStatus.isTrial) {
      const subStartTime = subStatus.created_at ? new Date(subStatus.created_at).getTime() : Date.now();
      const eligibleEntries = matchedEntries.filter(({ listing: l }) => {
        const listingTime = l.created_at ? new Date(l.created_at).getTime() : 0;
        return listingTime >= subStartTime;
      });
      const skippedOld = matchedEntries.length - eligibleEntries.length;
      if (skippedOld > 0) {
        const oldIds = matchedEntries
          .filter(({ listing: l }) => {
            const t = l.created_at ? new Date(l.created_at).getTime() : 0;
            return t < subStartTime;
          })
          .map(({ listing: l }) => l.id);
        try { await markEmailSent(sp.user_id, oldIds); } catch {}
        try { await markPushSent(sp.user_id, oldIds); } catch {}
        log(`[MATCH ENGINE] Backfill: ${skippedOld} listings older than subscription start — marked sent, visible in app only`);
      }
      if (eligibleEntries.length > 0) {
        const { data: userData } = await supabase.auth.admin.getUserById(sp.user_id);
        const email = userData?.user?.email;
        if (email) {
          for (const { listing: l, matched_at } of eligibleEntries) {
            bufferMatchAlert(sp.user_id, email, {
              listing_id: l.id,
              title: l.title,
              city: l.city,
              price: l.price,
              bedrooms: l.bedrooms,
              size_m2: l.size_m2,
              url: l.url,
              image_url: l.image_url,
              matched_at,
            });
          }
        }
      }
    } else {
      log(`[MATCH ENGINE] Skipping alert buffer for backfill user ${sp.user_id.substring(0, 8)}... — no active subscription`);
    }
  }

  log(`[MATCH ENGINE COMPLETE] profile=${searchProfileId} matches=${totalMatches} (from ${listings.length} recent listings)`);
  return totalMatches;
}
