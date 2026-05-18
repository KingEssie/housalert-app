export type SourceStatus = "active" | "broken" | "planned" | "gone";
export type SourcePriority = "high" | "medium" | "low";

export interface SourceRegistryEntry {
  name: string;
  displayName: string;
  status: SourceStatus;
  priority: SourcePriority;
  note?: string;
  url?: string;
  marketShare?: string;
  blockerType?: "bot-protection" | "auth-required" | "api-required" | "discontinued" | "timeout" | "none";
  estimatedListingsPerCity?: number;
  supportedCountries?: string[];
  implementationNotes?: string;
}

export const SOURCE_REGISTRY: SourceRegistryEntry[] = [
  {
    name: "wg-gesucht",
    displayName: "WG-Gesucht",
    status: "active",
    priority: "high",
    url: "https://www.wg-gesucht.de",
    marketShare: "Dominant for shared flats and furnished short-term rentals (DE)",
    blockerType: "none",
    estimatedListingsPerCity: 75,
    supportedCountries: ["DE", "AT", "CH"],
    implementationNotes: "REST JSON API at /api/asset/offers/. Pages 5 fetched per cycle. 2s delay between pages.",
  },
  {
    name: "immowelt",
    displayName: "Immowelt",
    status: "active",
    priority: "high",
    url: "https://www.immowelt.de",
    marketShare: "Top 3 German rental portal. Strong long-term apartment inventory.",
    blockerType: "none",
    estimatedListingsPerCity: 30,
    supportedCountries: ["DE", "AT"],
    implementationNotes: "Scrapes HTML listing pages. Some 410 Gone for smaller cities (immonet merger).",
  },
  {
    name: "kleinanzeigen",
    displayName: "Kleinanzeigen (eBay)",
    status: "active",
    priority: "high",
    note: "Phase 1: Berlin only. Two-stage session fetch with Chrome fingerprint. Bot-block detection + graceful fallback.",
    url: "https://www.kleinanzeigen.de",
    marketShare: "Massive inventory of private landlord listings — especially WGs, short-term, and non-agency apartments.",
    blockerType: "bot-protection",
    estimatedListingsPerCity: 120,
    supportedCountries: ["DE"],
    implementationNotes: "Scrapes HTML listing cards (article.aditem). Two-stage: root fetch for Cloudflare session cookies → paginated search. 3 pages × ~40 listings. Bot detection via HTML markers. Phase 1: Berlin only (PHASE1_ENABLED_CITIES gate in scraper). Expand to other cities after quality validation.",
  },
  {
    name: "immoscout24",
    displayName: "ImmoScout24",
    status: "broken",
    priority: "high",
    note: "Returns 401 — bot-blocked, API requires partnership",
    url: "https://www.immoscout24.de",
    marketShare: "Largest German rental portal. Professional landlords and agencies.",
    blockerType: "auth-required",
    estimatedListingsPerCity: 150,
    supportedCountries: ["DE", "AT", "CH"],
    implementationNotes: "Official API available under IS24 partner program. Free tier allows 100 req/day. Priority integration for subscription upsell.",
  },
  {
    name: "wohnungsboerse",
    displayName: "Wohnungsbörse",
    status: "broken",
    priority: "medium",
    note: "Returns 504 — gateway timeout on all requests",
    url: "https://www.wohnungsboerse.net",
    marketShare: "Medium-sized DE portal, mostly professional landlords.",
    blockerType: "timeout",
    estimatedListingsPerCity: 50,
    supportedCountries: ["DE"],
    implementationNotes: "Timeout suggests Cloudflare challenge page. May work with proper browser headers or proxy rotation.",
  },
  {
    name: "vonovia",
    displayName: "Vonovia",
    status: "planned",
    priority: "medium",
    url: "https://www.vonovia.de",
    marketShare: "Germany's largest residential landlord — 500k+ apartments. Direct scraping of their vacancy feed.",
    blockerType: "none",
    estimatedListingsPerCity: 20,
    supportedCountries: ["DE"],
    implementationNotes: "They have a public vacancy search at vonovia.de/wohnungen. JSON API likely available from browser DevTools. Safe to implement.",
  },
  {
    name: "deutsche-wohnen",
    displayName: "Deutsche Wohnen",
    status: "planned",
    priority: "medium",
    url: "https://www.deutsche-wohnen.com",
    marketShare: "Subsidiary of Vonovia. ~100k units in Berlin specifically. High value for Berlin users.",
    blockerType: "none",
    estimatedListingsPerCity: 15,
    supportedCountries: ["DE"],
    implementationNotes: "Vacancy search at deutsche-wohnen.com/en/residential-properties. Similar to Vonovia structure.",
  },
  {
    name: "immonet",
    displayName: "Immonet",
    status: "gone",
    priority: "low",
    note: "Returns 410 Gone — merged into Immowelt in 2024",
    url: "https://www.immonet.de",
    marketShare: "Discontinued. Inventory now available through Immowelt.",
    blockerType: "discontinued",
    supportedCountries: ["DE"],
    implementationNotes: "Removed from scraper. Immowelt covers this inventory.",
  },
  {
    name: "rentola",
    displayName: "Rentola",
    status: "broken",
    priority: "low",
    note: "Fetch timeout — server unresponsive",
    url: "https://www.rentola.de",
    marketShare: "Aggregator, mostly re-lists from other portals. Lower unique value.",
    blockerType: "timeout",
    supportedCountries: ["DE", "NL"],
    implementationNotes: "Unresponsive. De-prioritize.",
  },
  {
    name: "nestpick",
    displayName: "Nestpick",
    status: "broken",
    priority: "low",
    note: "Fetch timeout — server unresponsive",
    url: "https://www.nestpick.com",
    marketShare: "Furnished short-term rentals. Overlaps with WG-Gesucht inventory.",
    blockerType: "timeout",
    supportedCountries: ["DE", "NL"],
    implementationNotes: "Unresponsive. De-prioritize.",
  },
];

export function getActiveSourceRegistry(): SourceRegistryEntry[] {
  return SOURCE_REGISTRY.filter(s => s.status === "active");
}

export function getPlannedSourceRegistry(): SourceRegistryEntry[] {
  return SOURCE_REGISTRY.filter(s => s.status === "planned");
}
