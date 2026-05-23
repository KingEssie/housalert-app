import { log } from "../../../log";
import type { SourceListing } from "../types";

const BASE_URL =
  process.env.DAFT_DUBLIN_RENT_URL ||
  "https://www.daft.ie/property-for-rent/dublin-city";

const FETCH_TIMEOUT_MS = 20_000;

// Optional proxy. Supported formats (all env-based, none required):
//   ScraperAPI-style prefix:  DAFT_PROXY_URL=https://api.scraperapi.com?api_key=KEY&url=
//   Template with {url}:      DAFT_PROXY_URL=https://proxy.example.com/fetch?target={url}
//   Direct URL override:      DAFT_PROXY_URL=https://internal.mirror.example.com/daft-dublin
const PROXY_URL = (process.env.DAFT_PROXY_URL || "").trim();

// Headers for direct browser-like fetches.
// When routing through a URL-rewriting proxy (ScraperAPI etc.) these are sent
// along — most proxy services ignore or strip them and add their own.
const FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-IE,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Referer": "https://www.daft.ie/",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-User": "?1",
};

/** Resolve the actual URL to fetch, optionally routing through a proxy. */
function buildFetchUrl(targetUrl: string): { fetchUrl: string; method: "direct" | "proxy" } {
  if (!PROXY_URL) return { fetchUrl: targetUrl, method: "direct" };

  if (PROXY_URL.includes("{url}")) {
    return {
      fetchUrl: PROXY_URL.replace("{url}", encodeURIComponent(targetUrl)),
      method: "proxy",
    };
  }

  // Ends with = / & / ? → ScraperAPI-style URL prefix
  if (/[=&?]$/.test(PROXY_URL)) {
    return { fetchUrl: `${PROXY_URL}${encodeURIComponent(targetUrl)}`, method: "proxy" };
  }

  // Treat as a direct URL override (internal mirror, local proxy, etc.)
  return { fetchUrl: PROXY_URL, method: "proxy" };
}

function parsePrice(raw: string): number | undefined {
  const cleaned = raw.replace(/[€,\s]/g, "");
  const m = cleaned.match(/(\d{3,6})/);
  if (!m) return undefined;
  const num = parseInt(m[1], 10);
  return isNaN(num) || num <= 50 ? undefined : num;
}

function parseBedrooms(raw: string): number | undefined {
  if (/studio/i.test(raw)) return 0;
  const m = raw.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : undefined;
}

interface ParseResult {
  rawCount: number;
  listings: SourceListing[];
}

function extractFromNextData(html: string): ParseResult {
  const scriptMatch = html.match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>\s*(\{[\s\S]+?\})\s*<\/script>/
  );
  if (!scriptMatch) {
    if (html.includes("cf-browser-verification") || html.includes("Cloudflare") || html.includes("cf_clearance")) {
      log("[daft] Cloudflare challenge page detected — skipping this cycle", "daft");
    } else {
      const snippet = html.slice(0, 200).replace(/\s+/g, " ").trim();
      log(`[daft] No __NEXT_DATA__ in response (snippet: ${snippet})`, "daft");
    }
    return { rawCount: 0, listings: [] };
  }

  let json: any;
  try {
    json = JSON.parse(scriptMatch[1]);
  } catch (err: any) {
    log(`[daft] JSON parse error: ${err.message}`, "daft");
    return { rawCount: 0, listings: [] };
  }

  const pageProps = json?.props?.pageProps ?? {};

  // Daft has returned listings at various paths across Next.js versions
  const rawListings: any[] =
    pageProps?.listings ??
    pageProps?.data?.listings ??
    pageProps?.searchResults?.listings ??
    pageProps?.props?.listings ??
    [];

  const rawCount = Array.isArray(rawListings) ? rawListings.length : 0;

  if (!Array.isArray(rawListings) || rawListings.length === 0) {
    const keys = Object.keys(pageProps).join(", ") || "(empty)";
    log(`[daft] __NEXT_DATA__ found but no listings array (pageProps keys: ${keys})`, "daft");
    return { rawCount: 0, listings: [] };
  }

  const results: SourceListing[] = [];

  for (const entry of rawListings) {
    const l = entry?.listing ?? entry;
    if (!l) continue;

    const id = l.id != null ? String(l.id) : null;
    if (!id) continue;

    const seoPath: string = l.seoFriendlyPath || l.listingPage || "";
    const url = seoPath
      ? `https://www.daft.ie${seoPath.startsWith("/") ? seoPath : "/" + seoPath}`
      : `https://www.daft.ie/property-for-rent/dublin/${id}`;

    const title: string =
      l.header ||
      l.title ||
      l.propertyType ||
      "Dublin Rental";

    const priceRaw: string = l.price || "";
    const price = priceRaw ? parsePrice(priceRaw) : undefined;

    const bedroomsRaw: string = l.numBedrooms || l.bedrooms || "";
    const bedrooms = bedroomsRaw ? parseBedrooms(bedroomsRaw) : undefined;

    const images: any[] = l.media?.images ?? l.photos ?? [];
    const imageUrl: string | undefined =
      images[0]?.size600x600 ||
      images[0]?.size720x480 ||
      images[0]?.size360x240 ||
      images[0]?.url ||
      undefined;

    const location: string | undefined =
      l.address ||
      l.addressTown ||
      l.town ||
      undefined;

    const publishRaw: string = l.publishDate || l.listingDate || "";
    const createdAt = publishRaw ? new Date(publishRaw) : undefined;

    // Daft coordinates: point.coordinates = [longitude, latitude] (GeoJSON order)
    let latitude: number | undefined;
    let longitude: number | undefined;
    const coords: any[] | undefined = l.point?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      longitude = typeof coords[0] === "number" ? coords[0] : undefined;
      latitude  = typeof coords[1] === "number" ? coords[1] : undefined;
    }

    if (!title || !url || !id) continue;

    results.push({
      source:     "daft",
      externalId: id,
      title,
      price,
      location,
      url,
      imageUrl,
      bedrooms,
      createdAt,
      latitude,
      longitude,
    });
  }

  return { rawCount, listings: results };
}

export interface DaftFetchResult {
  method: "direct" | "proxy";
  proxyConfigured: boolean;
  status: number | null;
  rawCount: number;
  normalizedCount: number;
  listings: SourceListing[];
  error?: string;
}

async function doFetch(): Promise<DaftFetchResult> {
  const { fetchUrl, method } = buildFetchUrl(BASE_URL);
  const proxyConfigured = !!PROXY_URL;

  log(
    `[daft] Fetching via ${method}${proxyConfigured ? ` (proxy: ${PROXY_URL.slice(0, 40)}…)` : ""} → ${BASE_URL}`,
    "daft"
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let html: string;
  let status: number | null = null;

  try {
    const res = await fetch(fetchUrl, {
      headers: FETCH_HEADERS,
      signal:  controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    status = res.status;

    if (res.status === 403 || res.status === 503) {
      const proxyNote = method === "proxy" ? " (proxy did not bypass CF)" : "";
      log(`[daft] HTTP ${res.status} — Cloudflare block${proxyNote}, skipping`, "daft");
      return { method, proxyConfigured, status, rawCount: 0, normalizedCount: 0, listings: [] };
    }
    if (!res.ok) {
      log(`[daft] HTTP ${res.status} ${res.statusText} — skipping`, "daft");
      return { method, proxyConfigured, status, rawCount: 0, normalizedCount: 0, listings: [] };
    }

    html = await res.text();
  } catch (err: any) {
    clearTimeout(timer);
    const msg =
      err.name === "AbortError"
        ? `Fetch timed out after ${FETCH_TIMEOUT_MS / 1000}s`
        : `Fetch error: ${err.message}`;
    log(`[daft] ${msg}`, "daft");
    return { method, proxyConfigured, status, rawCount: 0, normalizedCount: 0, listings: [], error: msg };
  }

  const { rawCount, listings } = extractFromNextData(html);

  log(
    `[daft] HTTP ${status} (${method}) — raw candidates=${rawCount} normalized=${listings.length}`,
    "daft"
  );

  return { method, proxyConfigured, status, rawCount, normalizedCount: listings.length, listings };
}

/** Regular ingestion entry point — returns only the normalized listings. */
export async function fetchListings(): Promise<SourceListing[]> {
  const result = await doFetch();
  return result.listings;
}

/** Manual test entry point — returns richer metadata for the test script. */
export async function testFetch(): Promise<DaftFetchResult> {
  return doFetch();
}
