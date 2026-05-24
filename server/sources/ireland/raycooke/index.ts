/**
 * Ray Cooke Lettings fetcher for Dublin rentals.
 *
 * Ray Cooke uses a WordPress / JetEngine site that server-renders full
 * property cards — no JavaScript rendering required.
 *
 * Rental listings are at:
 *   https://raycooke.ie/properties/property/purpose-rent/
 *
 * Card structure (per listing):
 *   Each card begins with a data-post-id="N" attribute on a div element.
 *
 *   URL:   <a href="https://raycooke.ie/properties/SLUG/"> (one per card)
 *   Title: first jet-listing-dynamic-field__content that looks like an address
 *   Price: jet-listing-dynamic-field__content matching /€[\d,]+/
 *   Guard: "Monthly" text confirms rental (not sale)
 *   Image: first <img src="https://raycooke.ie/wp-content/uploads/...">
 *
 * External ID = URL slug (stable across re-crawls).
 * Bedrooms are not rendered in the listing-grid HTML cards.
 *
 * Direct Node.js fetch works — standard WordPress, no WAF/bot protection.
 * Set RAYCOOKE_PROXY_URL to route through a proxy if ever needed.
 */

import { log }                                   from "../../../log";
import type { SourceListing }                    from "../types";
import { BROWSER_HEADERS, FETCH_TIMEOUT_MS, parsePrice } from "../proxy";

const SOURCE      = "raycooke";
const LISTING_BASE = "https://raycooke.ie";
const BASE_URL    =
  process.env.RAYCOOKE_DUBLIN_URL ||
  "https://raycooke.ie/properties/property/purpose-rent/";

const MAX_PAGES = 3;

export interface RayCookeFetchResult {
  method:          "direct" | "proxy";
  proxyConfigured: boolean;
  status:          number | null;
  rawCount:        number;
  normalizedCount: number;
  listings:        SourceListing[];
  error?:          string;
}

// ── Parsing helpers ────────────────────────────────────────────────────────────

/**
 * Strip HTML tags and collapse whitespace from a raw HTML fragment.
 */
function stripHtml(raw: string): string {
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Extract Dublin area or county from an address string.
 *   "Griffith Lawns, Griffith Avenue, Dublin 9"  → "Dublin 9"
 *   "Brookdale Road, Swords, Co. Dublin"          → "Co. Dublin"
 */
function extractLocation(address: string): string {
  const m = address.match(/\bDublin\s*\d*\b|\bCo\.?\s*Dublin\b/i);
  return m ? m[0].trim() : "Dublin";
}

// ── Card extraction ────────────────────────────────────────────────────────────
//
// The page has a JetEngine listing grid.  Each property card begins with
// a wrapper element that carries:
//   data-post-id="N"
//
// We split the HTML on this attribute to isolate per-card chunks.
//
function extractFromHtml(html: string): SourceListing[] {
  // Only process the section of the page that contains listing cards.
  // The listing grid appears after "jet-listing-grid__item"; bail if missing.
  const gridStart = html.indexOf("jet-listing-grid__item");
  if (gridStart === -1) {
    log(`[${SOURCE}] Could not find listing grid in HTML`, SOURCE);
    return [];
  }

  // Split on card boundaries: data-post-id="NNN"
  const CARD_SPLIT = /(?=\bdata-post-id="\d+")/g;
  const blocks = html.slice(gridStart).split(CARD_SPLIT);

  const results: SourceListing[] = [];

  for (const block of blocks) {
    // ── Property URL & external ID ────────────────────────────────────────────
    // <a href="https://raycooke.ie/properties/SLUG/">
    const urlMatch = block.match(
      /href=["'](https?:\/\/raycooke\.ie\/properties\/([^/"']+)(?:\/)?)['"]/i
    );
    if (!urlMatch) continue;

    const url        = urlMatch[1].replace(/\/$/, "") + "/";
    const externalId = urlMatch[2].trim();
    if (!externalId) continue;

    // ── Rental guard: block must contain "Monthly" ────────────────────────────
    if (!block.includes("Monthly")) continue;

    // ── Extract all jet-listing-dynamic-field__content values ─────────────────
    const fieldContents: string[] = [];
    const FIELD_RE = /jet-listing-dynamic-field__content[^>]*>([\s\S]{1,400}?)<\/div>/gi;
    let fm: RegExpExecArray | null;
    while ((fm = FIELD_RE.exec(block)) !== null) {
      const text = stripHtml(fm[1]);
      if (text) fieldContents.push(text);
    }

    // ── Title: first field that looks like an address ─────────────────────────
    // Address lines typically contain a comma or "Dublin"
    const title = fieldContents.find(
      (f) => f.includes(",") || /\bdublin\b/i.test(f)
    ) ?? null;
    if (!title) continue;

    // ── Price: first field matching €NNN+ ─────────────────────────────────────
    const priceRaw  = fieldContents.find((f) => /^€[\d,]+$/.test(f.trim()));
    const price     = priceRaw ? parsePrice(priceRaw) : undefined;

    // ── Image ─────────────────────────────────────────────────────────────────
    // First <img> sourced from raycooke.ie wp-content uploads
    const imgMatch  = block.match(
      /src=["'](https?:\/\/raycooke\.ie\/wp-content\/uploads\/[^"']+\.(?:png|jpg|jpeg|webp)[^"']*)["']/i
    );
    const imageUrl  = imgMatch ? imgMatch[1] : undefined;

    // ── Location ──────────────────────────────────────────────────────────────
    const location  = extractLocation(title);

    results.push({
      source: SOURCE,
      externalId,
      title,
      price,
      location,
      url,
      imageUrl,
    });
  }

  return results;
}

// ── HTTP fetch ─────────────────────────────────────────────────────────────────

function resolveFetchUrl(pageUrl: string): { fetchUrl: string; method: "direct" | "proxy" } {
  const explicit = (process.env.RAYCOOKE_PROXY_URL || "").replace(/\s+/g, "");
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

// ── Main fetch ─────────────────────────────────────────────────────────────────

async function doFetch(): Promise<RayCookeFetchResult> {
  const { method: effectiveMethod } = resolveFetchUrl(BASE_URL);

  log(`[${SOURCE}] Fetching via ${effectiveMethod} → ${BASE_URL}`, SOURCE);

  const allListings: SourceListing[] = [];
  let totalRaw      = 0;
  let firstStatus:  number | null = null;
  let firstError:   string | undefined;

  for (let page = 1; page <= MAX_PAGES; page++) {
    // Ray Cooke uses /page/N/ pagination (standard WordPress)
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
        log(`[${SOURCE}] Page ${page}: 404 — end of pagination`, SOURCE);
        break;
      }
      if (status === 403 || status === 503) {
        log(`[${SOURCE}] HTTP ${status} — bot protection, stopping`, SOURCE);
        break;
      }
      log(`[${SOURCE}] Page ${page}: HTTP ${status}${error ? ` (${error})` : ""} — stopping`, SOURCE);
      break;
    }

    const pageListings = extractFromHtml(html);
    log(`[${SOURCE}] Page ${page}: HTTP ${status} — found ${pageListings.length} listing(s)`, SOURCE);

    if (pageListings.length === 0) break;

    const existingIds = new Set(allListings.map((l) => l.externalId));
    const newListings = pageListings.filter((l) => !existingIds.has(l.externalId));
    totalRaw         += pageListings.length;
    allListings.push(...newListings);

    // Stop if WordPress pagination signal is absent
    if (!html.includes(`/page/${page + 1}/`) && !html.includes('rel="next"')) break;
  }

  log(
    `[${SOURCE}] Complete: raw=${totalRaw} normalized=${allListings.length} (${effectiveMethod})`,
    SOURCE
  );

  return {
    method:          effectiveMethod,
    proxyConfigured: !!process.env.RAYCOOKE_PROXY_URL,
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

export async function testFetch(): Promise<RayCookeFetchResult> {
  return doFetch();
}
