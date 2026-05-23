import { log } from "../../../log";
import type { SourceListing } from "../types";
import {
  buildProxyUrl,
  isProxyConfigured,
  FETCH_TIMEOUT_MS,
  extractNextData,
} from "../proxy";
import { execFile } from "child_process";

const SOURCE_ENV = "PROPERTYPAL_PROXY_URL";
const LISTING_BASE = "https://www.propertypal.com";

const BASE_URL =
  process.env.PROPERTYPAL_DUBLIN_RENT_URL ||
  "https://www.propertypal.com/property-to-rent/dublin";

// PropertyPal blocks requests that include Sec-Fetch-* headers or a Windows
// user-agent. Use a minimal Mac-based browser header set.
const PP_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-IE,en-GB;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control":   "no-cache",
  "Pragma":          "no-cache",
  "Referer":         "https://www.propertypal.com/",
};

export interface PropertyPalFetchResult {
  method: "direct" | "proxy";
  proxyConfigured: boolean;
  status: number | null;
  rawCount: number;
  normalizedCount: number;
  listings: SourceListing[];
  error?: string;
}

// ── Guards ────────────────────────────────────────────────────────────────────

/** Reject Northern Ireland listings (countryCode === "GBR" or "NIR"). */
function isRepublicOfIreland(prop: any): boolean {
  const cc: string = (prop?.countryCode || "").toUpperCase();
  return cc === "" || cc === "IRL";
}

/** Confirm the listing is a rental (not for-sale). */
function isRentalListing(prop: any): boolean {
  const saleTypeKey: string = (prop?.saleType?.key || "").toLowerCase();
  const statusKey: string   = (prop?.status?.key   || "").toLowerCase();
  if (saleTypeKey === "sale") return false;
  if (statusKey   === "forsale" || statusKey === "sold") return false;
  return true;
}

// ── Extraction ────────────────────────────────────────────────────────────────

function extractListings(html: string): { rawCount: number; listings: SourceListing[] } {
  const { json, isCloudflare } = extractNextData(html);

  if (!json) {
    if (isCloudflare) {
      log("[propertypal] Cloudflare challenge detected — skipping this cycle", "propertypal");
    } else {
      const snippet = html.slice(0, 200).replace(/\s+/g, " ").trim();
      log(`[propertypal] No __NEXT_DATA__ in response (snippet: ${snippet})`, "propertypal");
    }
    return { rawCount: 0, listings: [] };
  }

  const pageProps = json?.props?.pageProps ?? {};

  // Confirmed shape: pageProps.initialState.properties.data.results
  // (data is a plain object: { results: [...], endReached, page, loading })
  const rawListings: any[] =
    pageProps?.initialState?.properties?.data?.results ??
    pageProps?.initialState?.properties?.results ??
    pageProps?.properties?.data?.results ??
    pageProps?.listings ??
    [];

  const rawCount = Array.isArray(rawListings) ? rawListings.length : 0;
  if (rawCount === 0) {
    const ppKeys  = Object.keys(pageProps).join(", ") || "(empty)";
    const initKeys = pageProps?.initialState
      ? Object.keys(pageProps.initialState).join(", ")
      : "n/a";
    const dataKeys = pageProps?.initialState?.properties?.data
      ? Object.keys(pageProps.initialState.properties.data).join(", ")
      : "n/a";
    log(
      `[propertypal] No listings array found ` +
        `(pageProps: ${ppKeys} | initialState: ${initKeys} | properties.data: ${dataKeys})`,
      "propertypal"
    );
    return { rawCount: 0, listings: [] };
  }

  const results: SourceListing[] = [];
  let skippedNI   = 0;
  let skippedSale = 0;

  for (const prop of rawListings) {
    if (!prop) continue;

    // ── Guards ──────────────────────────────────────────────────────────────
    if (!isRepublicOfIreland(prop)) { skippedNI++;   continue; }
    if (!isRentalListing(prop))     { skippedSale++; continue; }

    // ── External ID ─────────────────────────────────────────────────────────
    // `id` is the property listing ID; `pathId` is the URL identifier.
    // Use `id` as our stable dedup key (it's the canonical property record ID).
    const id = prop.id != null ? String(prop.id) : null;
    if (!id) continue;

    // ── URL ─────────────────────────────────────────────────────────────────
    // shareURL is the cleanest: "https://www.propertypal.com/1077585"
    // path is the full slug:    "/the-crescent.../1077585"
    // pathId is the numeric ID in the slug
    const url: string =
      prop.shareURL ||
      (prop.path
        ? `${LISTING_BASE}${prop.path.startsWith("/") ? prop.path : "/" + prop.path}`
        : prop.pathId
        ? `${LISTING_BASE}/${prop.pathId}`
        : `${LISTING_BASE}/${id}`);

    // ── Title ───────────────────────────────────────────────────────────────
    const title: string =
      prop.displayAddress ||
      prop.displayAddressLine1 ||
      [prop.addressLine1, prop.town].filter(Boolean).join(", ") ||
      "Dublin Rental";

    // ── Price ───────────────────────────────────────────────────────────────
    // price.price is already numeric (e.g. 2300); price.rentFrequency = "PER_MONTH"
    let price: number | undefined;
    if (typeof prop.price?.price === "number" && prop.price.price > 50) {
      price = prop.price.price;
    }

    // ── Bedrooms ────────────────────────────────────────────────────────────
    const bedrooms: number | undefined =
      typeof prop.numBedrooms === "number" ? prop.numBedrooms : undefined;

    // ── Image ───────────────────────────────────────────────────────────────
    const images: any[] = prop.images ?? prop.photos ?? [];
    const imageUrl: string | undefined =
      images[0]?.url ||
      images[0]?.urls?.["880x645:FILL_CROP"] ||
      undefined;

    // ── Location ────────────────────────────────────────────────────────────
    const location: string | undefined =
      prop.town || prop.region || undefined;

    // ── Coordinates ─────────────────────────────────────────────────────────
    // coordinate: { latitude: 53.249161, longitude: -6.180076 }
    let latitude: number | undefined;
    let longitude: number | undefined;
    const coord = prop.coordinate ?? prop.geo ?? null;
    if (coord) {
      const lat = coord.latitude  ?? coord.lat;
      const lon = coord.longitude ?? coord.lng ?? coord.lon;
      if (typeof lat === "number" && typeof lon === "number") {
        latitude  = lat;
        longitude = lon;
      }
    }

    // ── Listed date ─────────────────────────────────────────────────────────
    const rawDate = prop.dateAvailableFrom || prop.listingTime?.timeText || null;
    const createdAt = rawDate ? new Date(rawDate) : undefined;

    if (!title || !url) continue;

    results.push({
      source:     "propertypal",
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

  if (skippedNI   > 0) log(`[propertypal] Skipped ${skippedNI} Northern Ireland listing(s)`, "propertypal");
  if (skippedSale > 0) log(`[propertypal] Skipped ${skippedSale} for-sale listing(s)`, "propertypal");

  return { rawCount, listings: results };
}

// ── curl-based fetch ──────────────────────────────────────────────────────────
//
// PropertyPal's WAF (Cloudflare) fingerprints TLS handshakes (JA3/JA4).
// Node.js native fetch / undici advertises h2 in ALPN, which is fingerprinted
// and blocked with 403.  curl uses HTTP/1.1 TLS negotiation and returns 200
// from the same IP — proven on the Replit host.
//
// We use execFile('curl') as the HTTP client for this source only. It's:
//   • lightweight (curl ships with every Linux/macOS system)
//   • no new npm dependencies
//   • proven to return 200 from Replit's IP
//
// If a PROPERTYPAL_PROXY_URL is configured AND it supports curl-style -x usage,
// we pass it as a proxy; otherwise we make a direct curl call.
//
function fetchViaCurl(
  url: string,
  timeoutSec: number,
  proxyUrl?: string
): Promise<{ html: string; status: number }> {
  return new Promise((resolve, reject) => {
    const args: string[] = [
      "--silent",
      "--location",           // follow redirects
      "--max-redirs", "5",
      "--max-time", String(timeoutSec),
      "--compressed",         // accept gzip/br
      "--write-out", "\n__HTTP_STATUS__:%{http_code}",
      "-H", `User-Agent: ${PP_HEADERS["User-Agent"]}`,
      "-H", `Accept: ${PP_HEADERS["Accept"]}`,
      "-H", `Accept-Language: ${PP_HEADERS["Accept-Language"]}`,
      "-H", `Referer: ${PP_HEADERS["Referer"]}`,
      "-H", "Cache-Control: no-cache",
    ];

    // Wire in proxy if set (curl -x supports socks5 and http proxies)
    if (proxyUrl) {
      args.push("-x", proxyUrl);
    }

    args.push(url);

    execFile("curl", args, { maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && !stdout) {
        reject(new Error(`curl error: ${err.message}`));
        return;
      }
      const marker = "\n__HTTP_STATUS__:";
      const idx = stdout.lastIndexOf(marker);
      if (idx === -1) {
        reject(new Error("curl: could not parse HTTP status from output"));
        return;
      }
      const html   = stdout.slice(0, idx);
      const status = parseInt(stdout.slice(idx + marker.length).trim(), 10);
      resolve({ html, status });
    });
  });
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

/**
 * Resolve a curl-compatible proxy URL for PropertyPal.
 *
 * PropertyPal doesn't need a proxy from Replit's IP (direct curl → 200).
 * The DAFT_PROXY_URL fallback is a ScraperAPI URL-prefix API
 * ("https://api.scraperapi.com/?api_key=KEY&url="), NOT a curl -x proxy.
 * We only honour PROPERTYPAL_PROXY_URL if it's explicitly set AND looks like
 * a real proxy server (http(s)://host:port or socks5://host:port).
 */
function resolveCurlProxy(): string | undefined {
  const raw = (process.env.PROPERTYPAL_PROXY_URL || "").replace(/\s+/g, "");
  if (!raw) return undefined;
  // Accept http(s)://host... or socks5://host... — real curl proxy formats
  if (/^(https?:\/\/[^/]+:\d+|socks5:\/\/)/i.test(raw)) return raw;
  // ScraperAPI-style URL-prefix: pass as ScraperAPI URL param instead
  if (raw.includes("scraperapi.com") || raw.includes("{url}") || /[=&?]$/.test(raw)) {
    log("[propertypal] PROPERTYPAL_PROXY_URL looks like a URL-prefix API (not a curl proxy) — ignoring for curl", "propertypal");
  }
  return undefined;
}

async function doFetch(): Promise<PropertyPalFetchResult> {
  const proxyConfigured = isProxyConfigured(SOURCE_ENV);
  const curlProxy = resolveCurlProxy();
  const method: "direct" | "proxy" = curlProxy ? "proxy" : "direct";

  log(
    `[propertypal] Fetching via curl/${method}${curlProxy ? ` (proxy: ${curlProxy.slice(0, 40)}…)` : ""} → ${BASE_URL}`,
    "propertypal"
  );

  let status: number | null = null;

  try {
    const timeoutSec = Math.floor(FETCH_TIMEOUT_MS / 1000);
    const { html, status: s } = await fetchViaCurl(BASE_URL, timeoutSec, curlProxy);
    status = s;

    if (status === 403 || status === 503) {
      const note = method === "proxy" ? " (proxy did not bypass block)" : "";
      log(`[propertypal] HTTP ${status} — bot protection${note}, skipping`, "propertypal");
      return { method, proxyConfigured, status, rawCount: 0, normalizedCount: 0, listings: [] };
    }
    if (status < 200 || status >= 300) {
      log(`[propertypal] HTTP ${status} — skipping`, "propertypal");
      return { method, proxyConfigured, status, rawCount: 0, normalizedCount: 0, listings: [] };
    }

    const { rawCount, listings } = extractListings(html);
    log(
      `[propertypal] HTTP ${status} (curl/${method}) — raw=${rawCount} normalized=${listings.length}`,
      "propertypal"
    );
    return { method, proxyConfigured, status, rawCount, normalizedCount: listings.length, listings };
  } catch (err: any) {
    const msg = `Fetch error: ${err.message}`;
    log(`[propertypal] ${msg}`, "propertypal");
    return { method, proxyConfigured, status, rawCount: 0, normalizedCount: 0, listings: [], error: msg };
  }
}

export async function fetchListings(): Promise<SourceListing[]> {
  return (await doFetch()).listings;
}

export async function testFetch(): Promise<PropertyPalFetchResult> {
  return doFetch();
}
