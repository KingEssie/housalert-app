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
  };
  sourceIdRegex?: string;
  botBlockPatterns?: string[];
  rateLimitMs?: number;
}

const sources: SourceConfig[] = [
  {
    name: "wohnungsboerse",
    baseUrl: "https://www.wohnungsboerse.net",
    searchUrl: "https://www.wohnungsboerse.net/Berlin/mieten/wohnungen",
    city: "Berlin",
    source: "wohnungsboerse",
    cardSelector: "a[href*='/immodetail/']",
    fields: {
      title: { selector: "h3" },
      url: { selector: "a[href*='/immodetail/']", attr: "href" },
      price: { selector: "dl:has(dt:contains('Kaltmiete')) dd, dl:first-of-type dd", regex: "([\\d.]+)\\s*€" },
      size_m2: { selector: "dl:has(dt:contains('Fläche')) dd, dl:last-of-type dd", regex: "([\\d.,]+)\\s*m" },
      bedrooms: { selector: "dl:has(dt:contains('Zimmer')) dd, dl:nth-of-type(2) dd", regex: "([\\d,]+)" },
    },
    sourceIdRegex: "/immodetail/(\\d+)",
    rateLimitMs: 1000,
  },
  {
    name: "immoscout",
    baseUrl: "https://www.immobilienscout24.de",
    searchUrl: "https://www.immobilienscout24.de/Suche/de/berlin/wohnung-mieten",
    city: "Berlin",
    source: "immoscout",
    cardSelector: "article.result-list-entry, li.result-list-entry, article[data-item]",
    fields: {
      title: { selector: "h2, [data-is24-qa='expose_listing_title']" },
      url: { selector: "a[href*='/expose/']", attr: "href" },
      price: { selector: "[data-is24-qa='listing_price'], .result-list-entry__criteria dd:first-of-type", regex: "([\\d.]+)\\s*€" },
      size_m2: { selector: "[data-is24-qa='listing_area']", regex: "([\\d.,]+)\\s*m" },
      bedrooms: { selector: "[data-is24-qa='listing_rooms']", regex: "([\\d,]+)" },
    },
    sourceIdRegex: "/expose/(\\d+)",
    botBlockPatterns: ["Ich bin kein Roboter", "challenge.js", "Gleich geht"],
    rateLimitMs: 2000,
  },
  {
    name: "rentola",
    baseUrl: "https://rentola.de",
    searchUrl: "https://rentola.de/mieten/berlin",
    city: "Berlin",
    source: "rentola",
    cardSelector: "[data-testid='propertyTile']",
    fields: {
      title: { selector: "p.font-medium" },
      url: { selector: "a[href*='/listings/']", attr: "href" },
      price: { selector: "p.font-bold", regex: "([\\d.]+)\\s*€" },
      size_m2: { selector: "p.font-medium", regex: "([\\d.,]+)\\s*m" },
      bedrooms: { selector: "p.font-medium", regex: "(\\d+)\\s*Zimmer" },
    },
    sourceIdRegex: "/listings/[^-]+-p([a-z0-9]+)$",
    rateLimitMs: 1200,
  },
  {
    name: "nestpick",
    baseUrl: "https://www.nestpick.com",
    searchUrl: "https://www.nestpick.com/berlin/",
    city: "Berlin",
    source: "nestpick",
    cardSelector: ".card[data-id]",
    fields: {
      title: { selector: ".card-body-title" },
      url: { selector: ".card", attr: "data-url" },
      price: { selector: ".card", attr: "data-price" },
      size_m2: { selector: ".card", attr: "data-sqm" },
      bedrooms: { selector: ".card", attr: "data-rooms" },
    },
    sourceIdRegex: "/pick/(\\d+)/",
    rateLimitMs: 1200,
  },
  {
    name: "immonet",
    baseUrl: "https://www.immonet.de",
    searchUrl: "https://www.immonet.de/immobiliensuche/berlin/wohnung-mieten",
    city: "Berlin",
    source: "immonet",
    cardSelector: "article.result-list-entry, .result-list-entry, [data-testid*='result']",
    fields: {
      title: { selector: "h2, .result-list-entry__brand-title" },
      url: { selector: "a[href*='/expose/'], a[href*='/angebot/']", attr: "href" },
      price: { selector: "[data-is24-qa='listing_price'], .price", regex: "([\\d.]+)\\s*€" },
      size_m2: { selector: "[data-is24-qa='listing_area'], .area", regex: "([\\d.,]+)\\s*m" },
      bedrooms: { selector: "[data-is24-qa='listing_rooms'], .rooms", regex: "([\\d,]+)" },
    },
    sourceIdRegex: "/expose/(\\d+)|/angebot/(\\d+)",
    botBlockPatterns: ["Ich bin kein Roboter", "challenge.js"],
    rateLimitMs: 1200,
  },
];

export default sources;
