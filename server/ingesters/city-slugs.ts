export interface CitySlugs {
  slug: string;
  wgGesuchtCode?: number;
  kleinanzeigenCode?: string;
  is24State?: string;
}

const CITY_SLUG_MAP: Record<string, CitySlugs> = {
  "Berlin":       { slug: "berlin",           wgGesuchtCode: 8,   kleinanzeigenCode: "l3331", is24State: "berlin" },
  "München":      { slug: "muenchen",          wgGesuchtCode: 90,  kleinanzeigenCode: "l6411", is24State: "bayern" },
  "Hamburg":      { slug: "hamburg",           wgGesuchtCode: 55,  kleinanzeigenCode: "l9409", is24State: "hamburg" },
  "Köln":         { slug: "koeln",             wgGesuchtCode: 73,  kleinanzeigenCode: "l4315", is24State: "nordrhein-westfalen" },
  "Frankfurt":    { slug: "frankfurt-am-main", wgGesuchtCode: 41,  kleinanzeigenCode: "l4293", is24State: "hessen" },
  "Stuttgart":    { slug: "stuttgart",         wgGesuchtCode: 124, kleinanzeigenCode: "l4074", is24State: "baden-wuerttemberg" },
  "Düsseldorf":   { slug: "duesseldorf",       wgGesuchtCode: 30,  kleinanzeigenCode: "l4257", is24State: "nordrhein-westfalen" },
  "Leipzig":      { slug: "leipzig",           wgGesuchtCode: 77,  kleinanzeigenCode: "l8523", is24State: "sachsen" },
  "Dresden":      { slug: "dresden",           wgGesuchtCode: 27,  kleinanzeigenCode: "l8493", is24State: "sachsen" },
  "Nürnberg":     { slug: "nuernberg",         wgGesuchtCode: 96,  kleinanzeigenCode: "l6461", is24State: "bayern" },
  "Hannover":     { slug: "hannover",          wgGesuchtCode: 57,  kleinanzeigenCode: "l3682", is24State: "niedersachsen" },
  "Dortmund":     { slug: "dortmund",          wgGesuchtCode: 26,  kleinanzeigenCode: "l4471", is24State: "nordrhein-westfalen" },
  "Essen":        { slug: "essen",             wgGesuchtCode: 36,  kleinanzeigenCode: "l4452", is24State: "nordrhein-westfalen" },
  "Bremen":       { slug: "bremen",            wgGesuchtCode: 17,  kleinanzeigenCode: "l3564", is24State: "bremen" },
  "Duisburg":     { slug: "duisburg",          wgGesuchtCode: 28,  kleinanzeigenCode: "l4401", is24State: "nordrhein-westfalen" },
  "Bochum":       { slug: "bochum",            wgGesuchtCode: 13,  kleinanzeigenCode: "l4519", is24State: "nordrhein-westfalen" },
  "Wuppertal":    { slug: "wuppertal",         wgGesuchtCode: 141, kleinanzeigenCode: "l4380", is24State: "nordrhein-westfalen" },
  "Bonn":         { slug: "bonn",              wgGesuchtCode: 15,  kleinanzeigenCode: "l4341", is24State: "nordrhein-westfalen" },
  "Münster":      { slug: "muenster",          wgGesuchtCode: 91,  kleinanzeigenCode: "l3760", is24State: "nordrhein-westfalen" },
  "Mannheim":     { slug: "mannheim",          wgGesuchtCode: 84,  kleinanzeigenCode: "l5789", is24State: "baden-wuerttemberg" },
  "Karlsruhe":    { slug: "karlsruhe",         wgGesuchtCode: 68,  kleinanzeigenCode: "l5761", is24State: "baden-wuerttemberg" },
  "Augsburg":     { slug: "augsburg",          wgGesuchtCode: 2,   kleinanzeigenCode: "l6371", is24State: "bayern" },
  "Wiesbaden":    { slug: "wiesbaden",         wgGesuchtCode: 140, kleinanzeigenCode: "l5214", is24State: "hessen" },
  "Freiburg":     { slug: "freiburg-im-breisgau", wgGesuchtCode: 44, kleinanzeigenCode: "l5648", is24State: "baden-wuerttemberg" },
  "Aachen":       { slug: "aachen",            wgGesuchtCode: 1,   kleinanzeigenCode: "l4182", is24State: "nordrhein-westfalen" },
  "Mainz":        { slug: "mainz",             wgGesuchtCode: 83,  kleinanzeigenCode: "l5256", is24State: "rheinland-pfalz" },
  "Kiel":         { slug: "kiel",              wgGesuchtCode: 71,  kleinanzeigenCode: "l3538", is24State: "schleswig-holstein" },
  "Heidelberg":   { slug: "heidelberg",        wgGesuchtCode: 59,  kleinanzeigenCode: "l5793", is24State: "baden-wuerttemberg" },
  "Rostock":      { slug: "rostock",           wgGesuchtCode: 106, kleinanzeigenCode: "l8603", is24State: "mecklenburg-vorpommern" },
  "Potsdam":      { slug: "potsdam",           wgGesuchtCode: 101, kleinanzeigenCode: "l3375", is24State: "brandenburg" },
  "Darmstadt":    { slug: "darmstadt",         wgGesuchtCode: 23,  kleinanzeigenCode: "l5210", is24State: "hessen" },
  "Regensburg":   { slug: "regensburg",        wgGesuchtCode: 104, kleinanzeigenCode: "l6479", is24State: "bayern" },
  "Braunschweig": { slug: "braunschweig",      wgGesuchtCode: 16,  kleinanzeigenCode: "l3696", is24State: "niedersachsen" },
  "Bielefeld":    { slug: "bielefeld",         wgGesuchtCode: 12,  kleinanzeigenCode: "l3786", is24State: "nordrhein-westfalen" },
  "Erfurt":       { slug: "erfurt",            kleinanzeigenCode: "l8440", is24State: "thueringen" },
  "Magdeburg":    { slug: "magdeburg",         kleinanzeigenCode: "l8573", is24State: "sachsen-anhalt" },
  "Lübeck":       { slug: "luebeck",           kleinanzeigenCode: "l3554", is24State: "schleswig-holstein" },
  "Offenbach":    { slug: "offenbach-am-main", kleinanzeigenCode: "l5294", is24State: "hessen" },
  "Fürth":        { slug: "fuerth",            kleinanzeigenCode: "l6455", is24State: "bayern" },
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

export function getImmoScout24Url(city: string): string | null {
  const slugs = getCitySlugs(city);
  if (!slugs) return null;
  const state = slugs.is24State;
  if (!state) return null;
  return `https://www.immobilienscout24.de/Suche/de/${state}/${slugs.slug}/wohnung-mieten`;
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
