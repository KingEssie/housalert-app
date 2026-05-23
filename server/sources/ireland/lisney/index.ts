import { log } from "../../../log";
import type { SourceListing } from "../types";
import { BROWSER_HEADERS, FETCH_TIMEOUT_MS } from "../proxy";

const LISTING_BASE = "https://www.lisney.com";

// Server-rendered WordPress "to-let" status archive.
// This page contains all active rental listings for Lisney with full card HTML
// (price, beds, image, status/type flags) — no JS rendering required.
// Set LISNEY_DUBLIN_URL to override the base URL.
const BASE_URL =
  process.env.LISNEY_DUBLIN_URL ||
  "https://www.lisney.com/property-status/to-let/";

// Maximum pages to fetch per cycle (each page has ~12 listings).
const MAX_PAGES = 3;

export interface LisneyFetchResult {
  method:           "direct" | "proxy";
  proxyConfigured:  boolean;
  status:           number | null;
  rawCount:         number;
  normalizedCount:  number;
  listings:         SourceListing[];
  error?:           string;
}

// ── Parsing helpers ───────────────────────────────────────────────────────────

function attr(html: string, name: string): string | null {
  const m = html.match(new RegExp(`${name}=["']([^"']+)["']`, "i"));
  return m ? m[1] : null;
}

function text(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

function parsePrice(raw: string): number | undefined {
  const m = raw.replace(/[€,\s]/g, "").match(/(\d{3,6})/);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  return isNaN(n) || n <= 50 ? undefined : n;
}

// ── Card extraction ───────────────────────────────────────────────────────────
//
// Lisney uses a WordPress theme that server-renders full property cards in HTML.
// Each card is wrapped in:   <div class="property_box" markerid="N"> ... </div>
//
// Key signals inside each card:
//   id="property_prefill_address_{ID}"   → stable external ID
//   data-a2a-url="https://lisney.com/property/.../"  → canonical URL
//   data-a2a-title="..."                 → property title / address
//   datastatus="letman"                  → rental ("letman" = let by owner, agent)
//   datatype="R"                         → Residential (vs "C" Commercial)
//   div.pro_img style="background-image:url('...')" → image
//   div.property_bed > img .../> N       → bedrooms
//   div.price > €N,NNN / month           → price
//
function extractFromHtml(html: string): SourceListing[] {
  // Split into per-card blocks on the property_box boundary
  const cardBlocks = html.split(/(?=<div[^>]+class=["'][^"']*property_box[^"']*["'])/);

  const results: SourceListing[] = [];
  let skippedSale = 0;
  let skippedCommercial = 0;

  for (const block of cardBlocks) {
    if (!block.includes("property_box")) continue;

    // ── Rental guard ──────────────────────────────────────────────────────────
    // datastatus="letman" | "let" | "tolet" → OK
    // datastatus="forsale" | "saleagreed" | "sold" → skip
    const rawStatus = (attr(block, "datastatus") || "").toLowerCase();
    if (rawStatus && !rawStatus.includes("let")) {
      skippedSale++;
      continue;
    }

    // ── Residential guard ─────────────────────────────────────────────────────
    // datatype="R" → Residential; "C" → Commercial; "" → unknown (accept)
    const rawType = (attr(block, "datatype") || "").toUpperCase();
    if (rawType && rawType !== "R") {
      skippedCommercial++;
      continue;
    }

    // ── External ID ───────────────────────────────────────────────────────────
    // id="property_prefill_address_3097144"
    const idMatch = block.match(/id=["']property_prefill_address_(\d+)["']/);
    if (!idMatch) continue;
    const externalId = idMatch[1];

    // ── URL ───────────────────────────────────────────────────────────────────
    // data-a2a-url — most reliable; fall back to blankinfo_link href
    const rawUrl =
      text(block, /data-a2a-url=["']([^"']+)["']/) ||
      text(block, /class=["']blankinfo_link["'][^>]*href=["']([^"']+)["']/) ||
      text(block, /href=["'](https?:\/\/(?:www\.)?lisney\.com\/property\/[^"']+)["']/);
    const url = rawUrl
      ? rawUrl.startsWith("http")
        ? rawUrl
        : `${LISTING_BASE}${rawUrl.startsWith("/") ? rawUrl : "/" + rawUrl}`
      : `${LISTING_BASE}/property/${externalId}`;

    // ── Title ─────────────────────────────────────────────────────────────────
    // data-a2a-title — cleanest; fall back to property_title link text
    const titleRaw =
      text(block, /data-a2a-title=["']([^"']+)["']/) ||
      text(block, /class=["']property_title["'][^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/) ||
      text(block, /id=["']property_prefill_address_\d+["']>([^<]+)<\/div>/);
    const title = titleRaw ? titleRaw.replace(/&#\d+;/g, " ").trim() : null;
    if (!title) continue;

    // ── Price ─────────────────────────────────────────────────────────────────
    // div.price > €N,NNN / month
    const priceMatch = block.match(
      /<div[^>]*class=["'][^"']*\bprice\b[^"']*["'][^>]*>\s*(€[\d,\s]+(?:\/\s*month)?)\s*<\/div>/i
    );
    const price = priceMatch ? parsePrice(priceMatch[1]) : undefined;

    // ── Bedrooms ──────────────────────────────────────────────────────────────
    // div.property_bed > <img .../> N
    const bedsMatch = block.match(
      /<div[^>]*class=["'][^"']*property_bed[^"']*["'][^>]*>[\s\S]*?\/>[\s\W]*(\d+)/
    );
    const bedrooms = bedsMatch ? parseInt(bedsMatch[1], 10) : undefined;

    // ── Image ─────────────────────────────────────────────────────────────────
    // div.pro_img style="background-image:url('...')"
    const imgMatch = block.match(
      /class=["'][^"']*pro_img[^"']*["'][^>]*style=["'][^"']*background-image:url\(['"]?([^'")\s]+)['"]?\)/i
    );
    const imageUrl = imgMatch ? imgMatch[1] : undefined;

    // ── Location ──────────────────────────────────────────────────────────────
    // Extract from title: last part of comma-separated address often has county
    const parts = title.split(/,\s*/);
    const location = parts.length > 1 ? parts[parts.length - 1].trim() : "Dublin";

    results.push({
      source:     "lisney",
      externalId,
      title,
      price,
      location,
      url,
      imageUrl,
      bedrooms,
    });
  }

  if (skippedSale > 0) {
    log(`[lisney] Skipped ${skippedSale} for-sale/sale-agreed listing(s)`, "lisney");
  }
  if (skippedCommercial > 0) {
    log(`[lisney] Skipped ${skippedCommercial} commercial listing(s)`, "lisney");
  }

  return results;
}

// ── Fetch one page ────────────────────────────────────────────────────────────

async function doHttpGet(
  fetchUrl: string
): Promise<{ html: string | null; status: number; error?: string }> {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(fetchUrl, {
      headers:  { ...BROWSER_HEADERS, Referer: `${LISTING_BASE}/` },
      signal:   controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return { html: null, status: res.status };
    const html = await res.text();
    return { html, status: res.status };
  } catch (err: any) {
    clearTimeout(timer);
    const msg =
      err.name === "AbortError"
        ? `Timed out after ${FETCH_TIMEOUT_MS / 1000}s`
        : err.message;
    return { html: null, status: 0, error: msg };
  }
}

/**
 * Resolve the fetch URL for a given page.
 *
 * Strategy:
 *   1. If LISNEY_PROXY_URL is explicitly set, honour it (proxy mode).
 *   2. Otherwise use direct Node.js fetch (Lisney is plain WordPress — no
 *      Cloudflare TLS fingerprinting; curl smoke-tests return HTTP 200).
 *
 * We intentionally do NOT fall back to DAFT_PROXY_URL.  ScraperAPI returns
 * 403 for Lisney (different bot-protection profile), so routing through the
 * shared Daft proxy would always silently fail.
 */
function resolveFetchUrl(pageUrl: string): { fetchUrl: string; method: "direct" | "proxy" } {
  const explicit = (process.env.LISNEY_PROXY_URL || "").replace(/\s+/g, "");
  if (!explicit) return { fetchUrl: pageUrl, method: "direct" };

  if (explicit.includes("{url}"))
    return { fetchUrl: explicit.replace("{url}", encodeURIComponent(pageUrl)), method: "proxy" };
  if (/[=&?]$/.test(explicit))
    return { fetchUrl: `${explicit}${encodeURIComponent(pageUrl)}`, method: "proxy" };
  return { fetchUrl: explicit, method: "proxy" };
}

async function fetchPage(
  pageUrl: string,
): Promise<{ html: string | null; status: number; error?: string }> {
  const { fetchUrl } = resolveFetchUrl(pageUrl);
  return doHttpGet(fetchUrl);
}

// ── Page-level rental guard ───────────────────────────────────────────────────
//
// Belt-and-suspenders: confirm the response looks like a to-let results page,
// not a homepage redirect. Avoids the MyHome for-sale contamination pattern.
//
function isRentalResultPage(html: string, pageUrl: string): boolean {
  if (pageUrl.includes("to-let") || pageUrl.includes("property-status")) return true;
  if (
    html.includes("property-status/to-let") ||
    html.includes("datastatus=\"letman\"") ||
    html.includes("datastatus=\"let\"")
  )
    return true;
  return false;
}

// ── Main fetch ────────────────────────────────────────────────────────────────

async function doFetch(): Promise<LisneyFetchResult> {
  const { method: effectiveMethod } = resolveFetchUrl(BASE_URL);

  log(
    `[lisney] Fetching via ${effectiveMethod} → ${BASE_URL}`,
    "lisney"
  );

  const allListings: SourceListing[] = [];
  let totalRaw = 0;
  let firstStatus: number | null = null;
  let firstError: string | undefined;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const pageUrl = page === 1 ? BASE_URL : `${BASE_URL}page/${page}/`;

    const { html, status, error } = await fetchPage(pageUrl);

    if (page === 1) {
      firstStatus = status;
      firstError  = error;
    }

    if (!html) {
      if (status === 404 && page > 1) {
        // No more pages — expected end of pagination
        log(`[lisney] Page ${page}: 404 — end of pagination`, "lisney");
        break;
      }
      if (status === 403 || status === 503) {
        log(`[lisney] HTTP ${status} — bot protection, skipping`, "lisney");
        break;
      }
      log(`[lisney] Page ${page}: HTTP ${status}${error ? ` (${error})` : ""} — stopping`, "lisney");
      break;
    }

    // Page-level rental guard
    if (!isRentalResultPage(html, pageUrl)) {
      log(
        `[lisney] Page ${page} response does not look like a to-let results page — discarding`,
        "lisney"
      );
      break;
    }

    const pageListings = extractFromHtml(html);
    log(
      `[lisney] Page ${page}: HTTP ${status} — found ${pageListings.length} listing(s)`,
      "lisney"
    );

    if (pageListings.length === 0) break; // No more listings — stop paginating

    // Check for duplicate IDs across pages (safety dedup within one run)
    const existingIds = new Set(allListings.map(l => l.externalId));
    const newListings = pageListings.filter(l => !existingIds.has(l.externalId));
    totalRaw        += pageListings.length;
    allListings.push(...newListings);

    // Check if next page exists
    if (!html.includes(`page/${page + 1}/`) && !html.includes("rel=\"next\"")) break;
  }

  log(
    `[lisney] Complete: raw=${totalRaw} normalized=${allListings.length} (${effectiveMethod})`,
    "lisney"
  );

  return {
    method:          effectiveMethod,
    proxyConfigured: !!process.env.LISNEY_PROXY_URL,
    status:          firstStatus,
    rawCount:        totalRaw,
    normalizedCount: allListings.length,
    listings:        allListings,
    error:           firstError,
  };
}

export async function fetchListings(): Promise<SourceListing[]> {
  return (await doFetch()).listings;
}

export async function testFetch(): Promise<LisneyFetchResult> {
  return doFetch();
}
