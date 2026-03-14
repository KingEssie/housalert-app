export type CitySupportStatus = "supported" | "dynamic" | "unsupported";
export type CityTierSource = "tier1" | "tier2" | "tier3" | "none";

export interface CitySupport {
  status: CitySupportStatus;
  tier: CityTierSource;
}

const TIER_1 = new Set([
  "berlin", "hamburg", "muenchen", "koeln", "frankfurt", "stuttgart",
  "duesseldorf", "leipzig", "dresden", "hannover", "nuernberg", "bremen",
]);

const TIER_2 = new Set([
  "potsdam", "mannheim", "freiburg", "heidelberg", "bonn", "muenster",
  "karlsruhe", "augsburg", "bielefeld", "erfurt", "magdeburg", "luebeck",
  "mainz", "wiesbaden", "offenbach", "fuerth",
]);

const SCRAPER_EXTRA = new Set([
  "dortmund", "essen", "duisburg", "bochum", "wuppertal", "aachen",
  "kiel", "rostock", "darmstadt", "regensburg", "braunschweig",
]);

const ALIAS_MAP: Record<string, string> = {
  "munich": "muenchen",
  "cologne": "koeln",
  "dusseldorf": "duesseldorf",
  "nuremberg": "nuernberg",
  "hanover": "hannover",
  "frankfurt am main": "frankfurt",
  "freiburg im breisgau": "freiburg",
  "offenbach am main": "offenbach",
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

export function getCitySupport(cityName: string): CitySupport {
  const lower = cityName.toLowerCase().trim();
  const resolved = ALIAS_MAP[lower] || normalizeKey(cityName);

  if (TIER_1.has(resolved)) return { status: "supported", tier: "tier1" };
  if (TIER_2.has(resolved)) return { status: "supported", tier: "tier2" };
  if (SCRAPER_EXTRA.has(resolved)) return { status: "dynamic", tier: "tier3" };

  return { status: "unsupported", tier: "none" };
}
