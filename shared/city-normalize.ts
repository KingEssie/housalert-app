export type CitySupportStatus = "supported" | "dynamic" | "unsupported";
export type CityTierSource = "tier1" | "tier2" | "tier3" | "none";

export interface NormalizedCity {
  display_name: string;
  normalized_city: string;
  scraper_city_key: string;
  support_status: CitySupportStatus;
  tier_source: CityTierSource;
}

const TIER_1: string[] = [
  "Berlin", "Hamburg", "München", "Köln", "Frankfurt", "Stuttgart",
  "Düsseldorf", "Leipzig", "Dresden", "Hannover", "Nürnberg", "Bremen",
];

const TIER_2: string[] = [
  "Potsdam", "Mannheim", "Freiburg", "Heidelberg", "Bonn", "Münster",
  "Karlsruhe", "Augsburg", "Bielefeld", "Erfurt", "Magdeburg", "Lübeck",
  "Mainz", "Wiesbaden", "Offenbach", "Fürth",
];

const SCRAPER_SUPPORTED: string[] = [
  ...TIER_1, ...TIER_2,
  "Dortmund", "Essen", "Duisburg", "Bochum", "Wuppertal", "Aachen",
  "Kiel", "Rostock", "Darmstadt", "Regensburg", "Braunschweig",
];

const ALIAS_MAP: Record<string, string> = {
  "munich": "München",
  "muenchen": "München",
  "cologne": "Köln",
  "koeln": "Köln",
  "dusseldorf": "Düsseldorf",
  "duesseldorf": "Düsseldorf",
  "nuremberg": "Nürnberg",
  "nuernberg": "Nürnberg",
  "hannover": "Hannover",
  "hanover": "Hannover",
  "frankfurt am main": "Frankfurt",
  "frankfurt a.m.": "Frankfurt",
  "frankfurt/main": "Frankfurt",
  "freiburg im breisgau": "Freiburg",
  "freiburg i.br.": "Freiburg",
  "offenbach am main": "Offenbach",
  "offenbach a.m.": "Offenbach",
  "muenster": "Münster",
  "luebeck": "Lübeck",
  "fuerth": "Fürth",
};

function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

const _tier1Set = new Set(TIER_1.map(normalizeKey));
const _tier2Set = new Set(TIER_2.map(normalizeKey));
const _scraperSet = new Set(SCRAPER_SUPPORTED.map(normalizeKey));

const _canonicalMap = new Map<string, string>();
for (const c of SCRAPER_SUPPORTED) {
  _canonicalMap.set(normalizeKey(c), c);
}
for (const [alias, canonical] of Object.entries(ALIAS_MAP)) {
  _canonicalMap.set(alias.toLowerCase().trim(), canonical);
}

function resolveCanonical(input: string): string | null {
  const lower = input.toLowerCase().trim();
  if (_canonicalMap.has(lower)) return _canonicalMap.get(lower)!;

  const nk = normalizeKey(input);
  if (_canonicalMap.has(nk)) return _canonicalMap.get(nk)!;

  return null;
}

function makeCitySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function normalizeCity(displayName: string): NormalizedCity {
  const canonical = resolveCanonical(displayName);

  if (canonical) {
    const key = normalizeKey(canonical);
    let tier_source: CityTierSource = "none";
    let support_status: CitySupportStatus = "unsupported";

    if (_tier1Set.has(key)) {
      tier_source = "tier1";
      support_status = "supported";
    } else if (_tier2Set.has(key)) {
      tier_source = "tier2";
      support_status = "supported";
    } else if (_scraperSet.has(key)) {
      tier_source = "tier3";
      support_status = "dynamic";
    }

    return {
      display_name: canonical,
      normalized_city: makeCitySlug(canonical),
      scraper_city_key: canonical,
      support_status,
      tier_source,
    };
  }

  return {
    display_name: displayName,
    normalized_city: makeCitySlug(displayName),
    scraper_city_key: displayName,
    support_status: "unsupported",
    tier_source: "none",
  };
}

export function getCitySupportStatus(cityName: string): { status: CitySupportStatus; tier: CityTierSource } {
  const result = normalizeCity(cityName);
  return { status: result.support_status, tier: result.tier_source };
}
