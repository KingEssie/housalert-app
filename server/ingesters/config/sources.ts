export interface SourceConfig {
  name: string;
  baseUrl: string;
  searchUrl: string;
  city: string;
  source: string;
  cardSelector: string;
  fields: {
    title: { selector: string; attr?: string } | null;
    url: { selector: string; attr: string };
    price: { selector: string; attr?: string; regex?: string };
    size_m2: { selector: string; attr?: string; regex?: string };
    bedrooms: { selector: string; attr?: string; regex?: string } | null;
    image: { selector: string; attr: string } | null;
  };
  sourceIdRegex?: string;
  botBlockPatterns?: string[];
  rateLimitMs?: number;
}

interface SourceTemplate {
  name: string;
  baseUrl: string;
  source: string;
  cardSelector: string;
  fields: SourceConfig["fields"];
  sourceIdRegex?: string;
  botBlockPatterns?: string[];
  rateLimitMs?: number;
  buildSearchUrl: (slug: string) => string;
}

const templates: SourceTemplate[] = [
  {
    name: "immoscout",
    baseUrl: "https://www.immobilienscout24.de",
    source: "immoscout",
    cardSelector: "article.result-list-entry, li.result-list-entry, article[data-item]",
    fields: {
      title: { selector: "h2, [data-is24-qa='expose_listing_title']" },
      url: { selector: "a[href*='/expose/']", attr: "href" },
      price: { selector: "[data-is24-qa='listing_price'], .result-list-entry__criteria dd:first-of-type", regex: "([\\d.]+)\\s*€" },
      size_m2: { selector: "[data-is24-qa='listing_area']", regex: "([\\d.,]+)\\s*m" },
      bedrooms: { selector: "[data-is24-qa='listing_rooms']", regex: "([\\d,]+)" },
      image: null,
    },
    sourceIdRegex: "/expose/(\\d+)",
    botBlockPatterns: ["Ich bin kein Roboter", "challenge.js", "Gleich geht"],
    rateLimitMs: 2000,
    buildSearchUrl: (slug) => `https://www.immobilienscout24.de/Suche/de/${slug}/wohnung-mieten`,
  },
  {
    name: "rentola",
    baseUrl: "https://rentola.de",
    source: "rentola",
    cardSelector: "[data-testid='propertyTile']",
    fields: {
      title: { selector: "p.font-medium" },
      url: { selector: "a[href*='/listings/']", attr: "href" },
      price: { selector: "p.font-bold", regex: "([\\d.]+)\\s*€" },
      size_m2: { selector: "p.font-medium", regex: "([\\d.,]+)\\s*m" },
      bedrooms: { selector: "p.font-medium", regex: "(\\d+)\\s*Zimmer" },
      image: null,
    },
    sourceIdRegex: "/listings/[^-]+-p([a-z0-9]+)$",
    rateLimitMs: 1200,
    buildSearchUrl: (slug) => `https://rentola.de/mieten/${slug}`,
  },
  {
    name: "nestpick",
    baseUrl: "https://www.nestpick.com",
    source: "nestpick",
    cardSelector: ".card[data-id]",
    fields: {
      title: { selector: ".card-body-title" },
      url: { selector: ".card", attr: "data-url" },
      price: { selector: ".card", attr: "data-price" },
      size_m2: { selector: ".card", attr: "data-sqm" },
      bedrooms: { selector: ".card", attr: "data-rooms" },
      image: null,
    },
    sourceIdRegex: "/pick/(\\d+)/",
    rateLimitMs: 1200,
    buildSearchUrl: (slug) => `https://www.nestpick.com/${slug}/`,
  },
  {
    name: "immonet",
    baseUrl: "https://www.immonet.de",
    source: "immonet",
    cardSelector: "article.result-list-entry, .result-list-entry, [data-testid*='result']",
    fields: {
      title: { selector: "h2, .result-list-entry__brand-title" },
      url: { selector: "a[href*='/expose/'], a[href*='/angebot/']", attr: "href" },
      price: { selector: "[data-is24-qa='listing_price'], .price", regex: "([\\d.]+)\\s*€" },
      size_m2: { selector: "[data-is24-qa='listing_area'], .area", regex: "([\\d.,]+)\\s*m" },
      bedrooms: { selector: "[data-is24-qa='listing_rooms'], .rooms", regex: "([\\d,]+)" },
      image: null,
    },
    sourceIdRegex: "/expose/(\\d+)|/angebot/(\\d+)",
    botBlockPatterns: ["Ich bin kein Roboter", "challenge.js"],
    rateLimitMs: 1200,
    buildSearchUrl: (slug) => `https://www.immonet.de/immobiliensuche/${slug}/wohnung-mieten`,
  },
];

export function buildSourcesForCity(city: string, slug: string): SourceConfig[] {
  return templates.map((t) => ({
    name: t.name,
    baseUrl: t.baseUrl,
    searchUrl: t.buildSearchUrl(slug),
    city,
    source: t.source,
    cardSelector: t.cardSelector,
    fields: t.fields,
    sourceIdRegex: t.sourceIdRegex,
    botBlockPatterns: t.botBlockPatterns,
    rateLimitMs: t.rateLimitMs,
  }));
}

