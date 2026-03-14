export interface CitySlugs {
  slug: string;
  wgGesuchtCode?: number;
  kleinanzeigenCode?: string;
}

const CITY_SLUG_MAP: Record<string, CitySlugs> = {
  "Berlin": { slug: "berlin", wgGesuchtCode: 8, kleinanzeigenCode: "l3331" },
  "München": { slug: "muenchen", wgGesuchtCode: 90, kleinanzeigenCode: "l6411" },
  "Hamburg": { slug: "hamburg", wgGesuchtCode: 55, kleinanzeigenCode: "l9409" },
  "Köln": { slug: "koeln", wgGesuchtCode: 73, kleinanzeigenCode: "l4315" },
  "Frankfurt": { slug: "frankfurt-am-main", wgGesuchtCode: 41, kleinanzeigenCode: "l4293" },
  "Stuttgart": { slug: "stuttgart", wgGesuchtCode: 124, kleinanzeigenCode: "l4074" },
  "Düsseldorf": { slug: "duesseldorf", wgGesuchtCode: 30, kleinanzeigenCode: "l4257" },
  "Leipzig": { slug: "leipzig", wgGesuchtCode: 77, kleinanzeigenCode: "l8523" },
  "Dresden": { slug: "dresden", wgGesuchtCode: 27, kleinanzeigenCode: "l8493" },
  "Nürnberg": { slug: "nuernberg", wgGesuchtCode: 96, kleinanzeigenCode: "l6461" },
  "Hannover": { slug: "hannover", wgGesuchtCode: 57, kleinanzeigenCode: "l3682" },
  "Dortmund": { slug: "dortmund", wgGesuchtCode: 26, kleinanzeigenCode: "l4471" },
  "Essen": { slug: "essen", wgGesuchtCode: 36, kleinanzeigenCode: "l4452" },
  "Bremen": { slug: "bremen", wgGesuchtCode: 17, kleinanzeigenCode: "l3564" },
  "Duisburg": { slug: "duisburg", wgGesuchtCode: 28, kleinanzeigenCode: "l4401" },
  "Bochum": { slug: "bochum", wgGesuchtCode: 13, kleinanzeigenCode: "l4519" },
  "Wuppertal": { slug: "wuppertal", wgGesuchtCode: 141, kleinanzeigenCode: "l4380" },
  "Bonn": { slug: "bonn", wgGesuchtCode: 15, kleinanzeigenCode: "l4341" },
  "Münster": { slug: "muenster", wgGesuchtCode: 91, kleinanzeigenCode: "l3760" },
  "Mannheim": { slug: "mannheim", wgGesuchtCode: 84, kleinanzeigenCode: "l5789" },
  "Karlsruhe": { slug: "karlsruhe", wgGesuchtCode: 68, kleinanzeigenCode: "l5761" },
  "Augsburg": { slug: "augsburg", wgGesuchtCode: 2, kleinanzeigenCode: "l6371" },
  "Wiesbaden": { slug: "wiesbaden", wgGesuchtCode: 140, kleinanzeigenCode: "l5214" },
  "Freiburg": { slug: "freiburg-im-breisgau", wgGesuchtCode: 44, kleinanzeigenCode: "l5648" },
  "Aachen": { slug: "aachen", wgGesuchtCode: 1, kleinanzeigenCode: "l4182" },
  "Mainz": { slug: "mainz", wgGesuchtCode: 83, kleinanzeigenCode: "l5256" },
  "Kiel": { slug: "kiel", wgGesuchtCode: 71, kleinanzeigenCode: "l3538" },
  "Heidelberg": { slug: "heidelberg", wgGesuchtCode: 59, kleinanzeigenCode: "l5793" },
  "Rostock": { slug: "rostock", wgGesuchtCode: 106, kleinanzeigenCode: "l8603" },
  "Potsdam": { slug: "potsdam", wgGesuchtCode: 101, kleinanzeigenCode: "l3375" },
  "Darmstadt": { slug: "darmstadt", wgGesuchtCode: 23, kleinanzeigenCode: "l5210" },
  "Regensburg": { slug: "regensburg", wgGesuchtCode: 104, kleinanzeigenCode: "l6479" },
  "Braunschweig": { slug: "braunschweig", wgGesuchtCode: 16, kleinanzeigenCode: "l3696" },
  "Bielefeld": { slug: "bielefeld", wgGesuchtCode: 12, kleinanzeigenCode: "l3786" },
  "Erfurt": { slug: "erfurt", kleinanzeigenCode: "l8440" },
  "Magdeburg": { slug: "magdeburg", kleinanzeigenCode: "l8573" },
  "Lübeck": { slug: "luebeck", kleinanzeigenCode: "l3554" },
  "Offenbach": { slug: "offenbach-am-main", kleinanzeigenCode: "l5294" },
  "Fürth": { slug: "fuerth", kleinanzeigenCode: "l6455" },
};

function normalizeForLookup(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

const _normalizedIndex = new Map<string, string>();
for (const key of Object.keys(CITY_SLUG_MAP)) {
  _normalizedIndex.set(normalizeForLookup(key), key);
}

export function getCitySlugs(cityName: string): CitySlugs | null {
  if (CITY_SLUG_MAP[cityName]) return CITY_SLUG_MAP[cityName];

  const lower = cityName.toLowerCase().trim();
  for (const [key, val] of Object.entries(CITY_SLUG_MAP)) {
    if (key.toLowerCase() === lower) return val;
  }

  const normalized = normalizeForLookup(cityName);
  const mapped = _normalizedIndex.get(normalized);
  if (mapped) return CITY_SLUG_MAP[mapped];

  return null;
}

export function makeFallbackSlug(cityName: string): string {
  return cityName
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function getImmoweltUrl(city: string): string {
  const slugs = getCitySlugs(city);
  const slug = slugs?.slug ?? makeFallbackSlug(city);
  return `https://www.immowelt.de/suche/${slug}/wohnungen/mieten`;
}

const WG_GESUCHT_CITY_NAMES: Record<string, string> = {
  "München": "Muenchen",
  "Köln": "Koeln",
  "Düsseldorf": "Duesseldorf",
  "Nürnberg": "Nuernberg",
  "Münster": "Muenster",
  "Freiburg": "Freiburg-im-Breisgau",
  "Frankfurt": "Frankfurt-am-Main",
};

export function getWgGesuchtUrl(city: string): string | null {
  const slugs = getCitySlugs(city);
  if (!slugs?.wgGesuchtCode) return null;
  const urlCity = WG_GESUCHT_CITY_NAMES[city] ?? city;
  return `https://www.wg-gesucht.de/wohnungen-in-${urlCity}.${slugs.wgGesuchtCode}.2.1.0.html`;
}

export function getKleinanzeigenUrl(city: string): string | null {
  const slugs = getCitySlugs(city);
  if (!slugs?.kleinanzeigenCode) return null;
  const slug = slugs.slug;
  return `https://www.kleinanzeigen.de/s-wohnung-mieten/${slug}/c203${slugs.kleinanzeigenCode}`;
}

export function getConfigSourceUrls(city: string): Record<string, string> {
  const slugs = getCitySlugs(city);
  const slug = slugs?.slug ?? makeFallbackSlug(city);
  return {
    wohnungsboerse: `https://www.wohnungsboerse.net/${city}/mieten/wohnungen`,
    immoscout: `https://www.immobilienscout24.de/Suche/de/${slug}/wohnung-mieten`,
    rentola: `https://rentola.de/mieten/${slug}`,
    nestpick: `https://www.nestpick.com/${slug}/`,
    immonet: `https://www.immonet.de/immobiliensuche/${slug}/wohnung-mieten`,
  };
}
