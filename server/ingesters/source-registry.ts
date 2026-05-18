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
    status: "active",
    priority: "high",
    note: "Phase 1: Berlin only. AWS WAF + Imperva bot protection — returns botBlocked=true gracefully. Dual extraction: JSON-in-script (primary) → HTML card fallback. Data quality gate suppresses notifications on poor coverage.",
    url: "https://www.immobilienscout24.de",
    marketShare: "Largest German rental portal. Professional landlords and agencies. ~150 listings/city/day.",
    blockerType: "bot-protection",
    estimatedListingsPerCity: 150,
    supportedCountries: ["DE", "AT", "CH"],
    implementationNotes: "Scraper implemented with full browser fingerprint + two-stage session (root→cookies→search). Bot detection: HTTP 401/403, 'Ich bin kein Roboter', AwsWafIntegration markers. Falls back gracefully to zero results when blocked. Phase 1: Berlin only. Pagination: pagenumber=N query param, 3 pages × ~20 listings. JSON extraction from embedded React state script tag (primary), HTML card parsing fallback. Data quality gate: price≥55%, beds≥40%, size≥40%. expand to other cities after quality validation.",
  },
  {
    name: "wohnungsboerse",
    displayName: "Wohnungsbörse",
    status: "active",
    priority: "medium",
    note: "Phase 1: Berlin only. Previously returned 504; now accessible with proper Chrome browser headers. ~20 listings/cycle.",
    url: "https://www.wohnungsboerse.net",
    marketShare: "Medium-sized DE portal, mostly professional landlords and agencies.",
    blockerType: "none",
    estimatedListingsPerCity: 20,
    supportedCountries: ["DE"],
    implementationNotes: "Scrapes HTML listing cards (section.search_result_container a[href*=/immodetail/]). Two-stage session (root fetch → cookies → paginated search). Chrome 124 browser fingerprint headers required — plain requests get 504. 3 pages × ~20 listings. Bot detection: 401/403/429 + DataDome/Cloudflare markers. Graceful fallback when blocked. Phase 1: Berlin only (PHASE1_ENABLED_CITIES gate).",
  },
  {
    name: "vonovia",
    displayName: "Vonovia / Deutsche Wohnen",
    status: "active",
    priority: "medium",
    note: "Phase 1: Berlin only. Open JSON API — no bot protection, no cookies required. ~49 listings/cycle, 100% field coverage including precise building-level coordinates.",
    url: "https://www.deutsche-wohnen.com",
    marketShare: "Germany's largest residential landlord group (Vonovia + Deutsche Wohnen). ~550k units DE-wide, ~100k in Berlin alone.",
    blockerType: "none",
    estimatedListingsPerCity: 49,
    supportedCountries: ["DE"],
    implementationNotes: "Single ingester covers both Vonovia and Deutsche Wohnen brands (merged under same backend). JSON API: GET https://www.deutsche-wohnen.com/api/deuwo-real-estate/list?rentType=miete&city=Berlin&immoType=wohnung&pageSize=50&page=N. No auth, no cookies, no rate limiting observed. Returns structured JSON: wrk_id (source_id), titel, strasse, plz, ort (city + district as 'Berlin OT Zehlendorf'), preis (Warmmiete), groesse (m²), anzahl_zimmer, imageUrls[], slug, lat/lng (building precision). Expose URL: https://www.deutsche-wohnen.com/mieten/mietangebote/{slug}. Phase 1: Berlin only (PHASE1_ENABLED_CITIES gate). Pagination: pageSize=50 returns all ~49 Berlin apartments in 1 request. Anomaly detection flags if count drops below threshold.",
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
