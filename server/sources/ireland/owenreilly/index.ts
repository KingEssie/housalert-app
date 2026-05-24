/**
 * Owen Reilly fetcher for Dublin rentals.
 *
 * Owen Reilly is a boutique Dublin estate agent using a WordPress theme that
 * server-renders full property cards — no JavaScript rendering required.
 *
 * Rental listings are at:
 *   https://www.owenreilly.ie/property-status/for-rent/
 *
 * Card structure (per listing):
 *   <a href="https://www.owenreilly.ie/property/SLUG" class="item">
 *     <img class="property-img img-fluid" src="IMG_URL" />
 *     <p class="address">ADDRESS</p>
 *     <p class="price">€2,500 <span class="pm">per month</span></p>
 *     <div class="bottom"> ... N Bed ... </div>
 *   </a>
 *
 * Direct Node.js fetch works (standard WordPress, no bot protection).
 * Set OWENREILLY_PROXY_URL to route through a proxy if ever needed.
 */
import { log } from "../../../log";
import type { SourceListing } from "../types";
import { BROWSER_HEADERS, FETCH_TIMEOUT_MS } from "../proxy";

const LISTING_BASE = "https://www.owenreilly.ie";
const BASE_URL =
  process.env.OWENREILLY_DUBLIN_URL ||
  "https://www.owenreilly.ie/property-status/for-rent/";

const MAX_PAGES = 5;

export interface OwenReillyFetchResult {
  method:          "direct" | "proxy";
  proxyConfigured: boolean;
  status:          number | null;
  rawCount:        number;
  normalizedCount: number;
  listings:        SourceListing[];
  error?:          string;
}

// ── Parsing helpers ───────────────────────────────────────────────────────────

function parsePrice(raw: string): number | undefined {
  const m = raw.replace(/[€,\s]/g, "").match(/^(\d{3,6})/);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  return isNaN(n) || n < 200 ? undefined : n;
}

// ── Card extraction ───────────────────────────────────────────────────────────
//
// The property listing section begins with:
//   <section class="property_listing listing_page">
//
// Each individual listing card is an <a> element:
//   <a href="https://www.owenreilly.ie/property/SLUG" class="item">
//
// We split on these anchors to get per-card blocks.
//
function extractFromHtml(html: string): SourceListing[] {
  // Only look inside the main listing section to avoid nav "item" links
  const sectionStart = html.indexOf("property_listing listing_page");
  if (sectionStart === -1) {
    log("[owenreilly] Could not find listing section in HTML", "owenreilly");
    return [];
  }
  const listingSection = html.slice(sectionStart);

  // Split on listing card anchors pointing to /property/ paths
  const CARD_SPLIT = /(?=<a\s[^>]*href=["']https?:\/\/www\.owenreilly\.ie\/property\/)/gi;
  const blocks = listingSection.split(CARD_SPLIT);

  const results: SourceListing[] = [];

  for (const block of blocks) {
    // Must be a property anchor
    const urlMatch = block.match(
      /href=["'](https?:\/\/www\.owenreilly\.ie\/property\/([^"'/?#]+))/
    );
    if (!urlMatch) continue;

    const url        = urlMatch[1];
    const externalId = urlMatch[2]; // URL slug as stable ID

    // ── Title / Address ───────────────────────────────────────────────────────
    // <p class="address">ADDRESS</p>
    const addrMatch = block.match(/<p\s[^>]*class=["'][^"']*\baddress\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
    const title = addrMatch
      ? addrMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
      : null;
    if (!title) continue;

    // ── Price ─────────────────────────────────────────────────────────────────
    // <p class="price">€2,500 <span class="pm">per month</span></p>
    const priceMatch = block.match(/<p\s[^>]*class=["'][^"']*\bprice\b[^"']*["'][^>]*>\s*(€[\d,]+)/i);
    const price = priceMatch ? parsePrice(priceMatch[1]) : undefined;

    // ── Bedrooms ──────────────────────────────────────────────────────────────
    // Text inside <div class="bottom"> often contains "N Bed" or "N Bedroom"
    const bottomMatch = block.match(/<div\s[^>]*class=["'][^"']*\bbottom\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    let bedrooms: number | undefined;
    if (bottomMatch) {
      const bedMatch = bottomMatch[1].match(/(\d+)\s*(?:Bed|bed)/);
      if (bedMatch) bedrooms = parseInt(bedMatch[1], 10);
    }
    // Fallback: scan whole card for bed count
    if (!bedrooms) {
      const fallback = block.match(/\b(\d+)\s*(?:Bed|bedroom)\b/i);
      if (fallback) bedrooms = parseInt(fallback[1], 10);
    }

    // ── Image ─────────────────────────────────────────────────────────────────
    // <img class="property-img img-fluid" src="URL" />
    const imgMatch = block.match(/<img\s[^>]*class=["'][^"']*\bproperty-img\b[^"']*["'][^>]*>/i);
    let imageUrl: string | undefined;
    if (imgMatch) {
      const srcMatch = imgMatch[0].match(/\bsrc=["']([^"']+)["']/i);
      if (srcMatch && !srcMatch[1].startsWith("data:")) {
        imageUrl = srcMatch[1];
      }
    }

    // ── Location ──────────────────────────────────────────────────────────────
    // Extract "Dublin N" or "Co. Dublin" from address
    const locMatch = title.match(/\bDublin\s*\d*\b|\bCo\.?\s*Dublin\b/i);
    const location = locMatch ? locMatch[0].trim() : "Dublin";

    results.push({
      source:     "owenreilly",
      externalId,
      title,
      price,
      location,
      url,
      imageUrl,
      bedrooms,
    });
  }

  return results;
}

// ── HTTP fetch ────────────────────────────────────────────────────────────────

function resolveFetchUrl(pageUrl: string): { fetchUrl: string; method: "direct" | "proxy" } {
  const explicit = (process.env.OWENREILLY_PROXY_URL || "").replace(/\s+/g, "");
  if (!explicit) return { fetchUrl: pageUrl, method: "direct" };
  if (explicit.includes("{url}"))
    return { fetchUrl: explicit.replace("{url}", encodeURIComponent(pageUrl)), method: "proxy" };
  if (/[=&?]$/.test(explicit))
    return { fetchUrl: `${explicit}${encodeURIComponent(pageUrl)}`, method: "proxy" };
  return { fetchUrl: explicit, method: "proxy" };
}

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

// ── Main fetch ────────────────────────────────────────────────────────────────

async function doFetch(): Promise<OwenReillyFetchResult> {
  const { method: effectiveMethod } = resolveFetchUrl(BASE_URL);

  log(
    `[owenreilly] Fetching via ${effectiveMethod} → ${BASE_URL}`,
    "owenreilly"
  );

  const allListings: SourceListing[] = [];
  let totalRaw     = 0;
  let firstStatus: number | null = null;
  let firstError:  string | undefined;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const pageUrl = page === 1
      ? BASE_URL
      : BASE_URL.replace(/\/?$/, "") + `/page/${page}/`;

    const { fetchUrl } = resolveFetchUrl(pageUrl);
    const { html, status, error } = await doHttpGet(fetchUrl);

    if (page === 1) {
      firstStatus = status;
      firstError  = error;
    }

    if (!html) {
      if (status === 404 && page > 1) {
        log(`[owenreilly] Page ${page}: 404 — end of pagination`, "owenreilly");
        break;
      }
      if (status === 403 || status === 503) {
        log(`[owenreilly] HTTP ${status} — bot protection, stopping`, "owenreilly");
        break;
      }
      log(
        `[owenreilly] Page ${page}: HTTP ${status}${error ? ` (${error})` : ""} — stopping`,
        "owenreilly"
      );
      break;
    }

    const pageListings = extractFromHtml(html);
    log(
      `[owenreilly] Page ${page}: HTTP ${status} — found ${pageListings.length} listing(s)`,
      "owenreilly"
    );

    if (pageListings.length === 0) break;

    const existingIds  = new Set(allListings.map(l => l.externalId));
    const newListings  = pageListings.filter(l => !existingIds.has(l.externalId));
    totalRaw          += pageListings.length;
    allListings.push(...newListings);

    // Stop if no next-page signal
    if (!html.includes(`/page/${page + 1}/`) && !html.includes('rel="next"')) break;
  }

  log(
    `[owenreilly] Complete: raw=${totalRaw} normalized=${allListings.length} (${effectiveMethod})`,
    "owenreilly"
  );

  return {
    method:          effectiveMethod,
    proxyConfigured: !!process.env.OWENREILLY_PROXY_URL,
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

export async function testFetch(): Promise<OwenReillyFetchResult> {
  return doFetch();
}
