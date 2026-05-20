import { log } from "../log";
import type { Ingester, IngestionResult } from "./types";
import type { ParsedListing } from "./matching";
import { insertAndMatchListings } from "./matching";

const DW_API_BASE = "https://www.deutsche-wohnen.com/api/deuwo-real-estate/list";
const DW_EXPOSE_BASE = "https://www.deutsche-wohnen.com/mieten/mietangebote";
const SOURCE_NAME = "vonovia";

const FETCH_TIMEOUT_MS = 25_000;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 3_000;
const PAGE_SIZE = 50;
const MAX_PAGES = 10;
const MIN_LISTINGS_ANOMALY = 5;

const PHASE1_ENABLED_CITIES = new Set(["Berlin"]);

interface DwPaging {
  info: { count: number; limit: number };
}

interface DwListing {
  wrk_id: string;
  titel?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  preis?: number;
  groesse?: number;
  anzahl_zimmer?: number;
  preview_img_url?: string;
  imageUrls?: string[];
  slug?: string;
  lat?: number;
  lng?: number;
  has_grundriss?: boolean;
  vermarktungsart_miete?: string;
  tour_link_360?: string;
}

interface DwApiResponse {
  paging?: { info?: { count?: number; limit?: number } };
  results?: DwListing[];
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function parseDistrict(ort: string | undefined): string | null {
  if (!ort) return null;
  const match = ort.match(/\bOT\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function parseCity(ort: string | undefined, fallback: string): string {
  if (!ort) return fallback;
  const before = ort.split(/\bOT\b/i)[0].trim();
  return before || fallback;
}

function buildExposeUrl(slug: string | undefined, wrkId: string): string {
  if (slug) return `${DW_EXPOSE_BASE}/${slug}`;
  return `${DW_EXPOSE_BASE}?id=${wrkId}`;
}

function bestImageUrl(item: DwListing): string | null {
  const url = item.imageUrls?.[0] ?? item.preview_img_url;
  if (!url) return null;
  return url.replace(/\?width=\d+(&crop=[\d:]+)?/, "?width=800&crop=4:3");
}

async function fetchApiPage(city: string, page: number, attempt: number): Promise<{
  data?: DwApiResponse;
  error?: string;
}> {
  const params = new URLSearchParams({
    rentType: "miete",
    city,
    immoType: "wohnung",
    pageSize: String(PAGE_SIZE),
    page: String(page),
  });
  const url = `${DW_API_BASE}?${params}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": "https://www.deutsche-wohnen.com/mieten/mietangebote",
        "Origin": "https://www.deutsche-wohnen.com",
        "X-Requested-With": "XMLHttpRequest",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
    });

    if (!resp.ok) {
      return { error: `HTTP ${resp.status} ${resp.statusText}` };
    }

    const contentType = resp.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      const text = await resp.text();
      return { error: `Non-JSON response (${contentType}) — length ${text.length}` };
    }

    const data: DwApiResponse = await resp.json();
    return { data };
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return { error: `Timeout after ${FETCH_TIMEOUT_MS}ms (attempt ${attempt})` };
    }
    return { error: String(err?.message ?? err) };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchApiPageWithRetry(city: string, page: number): Promise<{
  data?: DwApiResponse;
  error?: string;
}> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const result = await fetchApiPage(city, page, attempt);
    if (!result.error) return result;
    if (attempt < MAX_RETRIES) {
      log(`[VONOVIA] Page ${page} attempt ${attempt} failed (${result.error}) — retrying in ${RETRY_BASE_MS * attempt}ms`);
      await delay(RETRY_BASE_MS * attempt);
    } else {
      return result;
    }
  }
  return { error: "Max retries exceeded" };
}

function normalizeItem(item: DwListing, city: string): ParsedListing | null {
  if (!item.wrk_id) return null;

  const district = parseDistrict(item.ort);
  const resolvedCity = parseCity(item.ort, city);
  const exposeUrl = buildExposeUrl(item.slug, item.wrk_id);
  const imageUrl = bestImageUrl(item);

  const lat = item.lat && item.lat !== 0 ? item.lat : null;
  const lng = item.lng && item.lng !== 0 ? item.lng : null;

  const extraFeatures: string[] = [];
  if (item.has_grundriss) extraFeatures.push("grundriss");
  if (item.tour_link_360) extraFeatures.push("360-tour");

  return {
    source: SOURCE_NAME,
    source_id: String(item.wrk_id),
    title: item.titel?.trim() || `Wohnung in ${resolvedCity}`,
    url: exposeUrl,
    city: resolvedCity,
    price: typeof item.preis === "number" ? Math.round(item.preis) : 0,
    size_m2: typeof item.groesse === "number" ? item.groesse : 0,
    bedrooms: typeof item.anzahl_zimmer === "number" ? item.anzahl_zimmer : 0,
    image_url: imageUrl,
    district,
    postcode: item.plz || null,
    street: item.strasse || null,
    latitude: lat,
    longitude: lng,
    coordinate_source: lat != null ? "direct" : undefined,
    coordinate_precision: lat != null ? "building" : undefined,
    property_type: "apartment",
    extra_features: extraFeatures.length > 0 ? extraFeatures : null,
  };
}

export async function fetchAllListings(city: string, options?: { maxPages?: number }): Promise<{
  listings: ParsedListing[];
  apiTotal: number;
  pagesAttempted: number;
  pagesFetched: number;
  anomaly: boolean;
  anomalyReason: string;
  fatalError?: string;
}> {
  const listings: ParsedListing[] = [];
  const seenIds = new Set<string>();
  let apiTotal = 0;
  let pagesAttempted = 0;
  let pagesFetched = 0;
  let anomaly = false;
  let anomalyReason = "";
  const maxPages = options?.maxPages ?? MAX_PAGES;

  for (let page = 1; page <= maxPages; page++) {
    pagesAttempted++;
    const { data, error } = await fetchApiPageWithRetry(city, page);

    if (error) {
      log(`[VONOVIA] API error on page ${page}: ${error}`);
      if (page === 1) {
        return {
          listings: [],
          apiTotal: 0,
          pagesAttempted,
          pagesFetched,
          anomaly: true,
          anomalyReason: `API fetch failed: ${error}`,
          fatalError: error,
        };
      }
      break;
    }

    const raw = data?.results ?? [];
    const count = data?.paging?.info?.count ?? 0;

    if (page === 1) {
      apiTotal = count;
      log(`[VONOVIA] ${city}: API reports ${apiTotal} total apartments`);
      if (apiTotal === 0) {
        anomaly = true;
        anomalyReason = `API returned count=0 for ${city} — possible endpoint change`;
      } else if (apiTotal < MIN_LISTINGS_ANOMALY) {
        anomaly = true;
        anomalyReason = `Unusually low count: ${apiTotal} (threshold: ${MIN_LISTINGS_ANOMALY})`;
      }
    }

    if (raw.length === 0) {
      if (page === 1) {
        anomaly = true;
        anomalyReason = anomalyReason || `No results in page 1 response`;
      } else {
        log(`[VONOVIA] Page ${page} empty — stopping pagination`);
      }
      break;
    }

    pagesFetched++;
    let newOnPage = 0;
    for (const item of raw) {
      if (!item.wrk_id || seenIds.has(item.wrk_id)) continue;
      seenIds.add(item.wrk_id);
      const parsed = normalizeItem(item, city);
      if (parsed) {
        listings.push(parsed);
        newOnPage++;
      }
    }

    if (newOnPage === 0 && page > 1) {
      log(`[VONOVIA] No new listings on page ${page} — stopping pagination`);
      break;
    }

    if (raw.length < PAGE_SIZE) break;
    if (listings.length >= apiTotal && apiTotal > 0) break;
  }

  return { listings, apiTotal, pagesAttempted, pagesFetched, anomaly, anomalyReason };
}

function qualityReport(listings: ParsedListing[]): {
  ok: boolean;
  summary: string;
  pricePct: number;
  sizePct: number;
  roomsPct: number;
  coordsPct: number;
} {
  const n = listings.length;
  if (n === 0) return { ok: false, summary: "no listings", pricePct: 0, sizePct: 0, roomsPct: 0, coordsPct: 0 };
  const withPrice = listings.filter(l => l.price > 0).length;
  const withSize = listings.filter(l => l.size_m2 > 0).length;
  const withRooms = listings.filter(l => l.bedrooms > 0).length;
  const withCoords = listings.filter(l => l.latitude != null).length;
  const pricePct = Math.round((withPrice / n) * 100);
  const sizePct = Math.round((withSize / n) * 100);
  const roomsPct = Math.round((withRooms / n) * 100);
  const coordsPct = Math.round((withCoords / n) * 100);
  const ok = pricePct >= 80 && sizePct >= 70 && roomsPct >= 70;
  const summary = `price=${pricePct}% size=${sizePct}% rooms=${roomsPct}% coords=${coordsPct}%`;
  return { ok, summary, pricePct, sizePct, roomsPct, coordsPct };
}

export function createVonoviaIngester(city: string, options?: { maxPages?: number }): Ingester {
  return {
    name: `vonovia:${city}`,
    async run(): Promise<IngestionResult> {
      if (!PHASE1_ENABLED_CITIES.has(city)) {
        log(`[VONOVIA] ${city} not in Phase 1 rollout (enabled: ${[...PHASE1_ENABLED_CITIES].join(", ")}) — skipping`);
        return { found: 0, inserted: 0, duplicates: 0, matches: 0, errors: 0 };
      }

      log(`[VONOVIA] Fetching Vonovia/Deutsche Wohnen ${city} listings — ${DW_API_BASE}`);

      const { listings, apiTotal, pagesAttempted, pagesFetched, anomaly, anomalyReason, fatalError } =
        await fetchAllListings(city, options);

      if (anomaly) {
        log(`[VONOVIA] ANOMALY for ${city}: ${anomalyReason}`);
      }

      if (fatalError && listings.length === 0) {
        log(`[VONOVIA] Fatal error for ${city}: ${fatalError} — aborting cycle`);
        return { found: 0, inserted: 0, duplicates: 0, matches: 0, errors: 1 };
      }

      if (listings.length === 0) {
        log(`[VONOVIA] ${city}: no listings returned (api_total=${apiTotal}, pages=${pagesAttempted})`);
        return { found: 0, inserted: 0, duplicates: 0, matches: 0, errors: 0 };
      }

      const quality = qualityReport(listings);
      log(`[VONOVIA] ${city} quality: ${quality.summary}`);
      if (!quality.ok) {
        log(`[VONOVIA] ${city} quality gate DEGRADED — inserting but notifications suppressed by match engine if no price`);
      }

      const result = await insertAndMatchListings(listings);

      log(
        `[VONOVIA] Vonovia/DW ${city} ingestion complete: ` +
        `api_total=${apiTotal} found=${listings.length} pages=${pagesFetched}/${pagesAttempted} ` +
        `inserted=${result.inserted} duplicates=${result.duplicates} ` +
        `matches=${result.matches} errors=${result.errors}`,
      );

      return { found: listings.length, ...result };
    },
  };
}
