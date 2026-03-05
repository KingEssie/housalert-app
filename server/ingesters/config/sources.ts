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
    price: { selector: string; regex?: string };
    size_m2: { selector: string; regex?: string };
    bedrooms: { selector: string; regex?: string } | null;
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
];

export default sources;
