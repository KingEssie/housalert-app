/**
 * City Homes fetcher for Dublin 12 rentals.
 *
 * City Homes (cityhomes.ie) is a Dublin 12 estate agency using WordPress
 * with Elementor. Their WordPress REST API is publicly accessible and returns
 * server-rendered data without JS rendering.
 *
 * API endpoint:
 *   GET https://cityhomes.ie/wp-json/wp/v2/properties
 *     ?property_categories=20   — taxonomy term ID 20 = "To Let"
 *     &per_page=100             — fetch all (they have ~33 active listings)
 *     &_embed                   — includes featured image in response
 *
 * Price and bedroom data are not available in the REST API (Elementor
 * dynamic fields). Listings are returned with title, canonical URL, and
 * featured image where available. Location is fixed to "Dublin 12".
 *
 * Direct Node.js fetch works. No proxy required.
 */
import { log } from "../../../log";
import type { SourceListing } from "../types";
import { BROWSER_HEADERS, FETCH_TIMEOUT_MS } from "../proxy";

const SOURCE   = "cityhomes";
const BASE_URL = "https://cityhomes.ie";
const API_URL  =
  process.env.CITYHOMES_API_URL ||
  `${BASE_URL}/wp-json/wp/v2/properties?property_categories=20&per_page=100&_embed&_fields=id,slug,title,link,_embedded`;

export interface CityhomesFetchResult {
  method:          "direct";
  status:          number | null;
  rawCount:        number;
  normalizedCount: number;
  listings:        SourceListing[];
  error?:          string;
}

// ── HTTP fetch ────────────────────────────────────────────────────────────────

async function doHttpGet(url: string): Promise<{ body: string | null; status: number; error?: string }> {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        ...BROWSER_HEADERS,
        Accept: "application/json",
        Referer: `${BASE_URL}/`,
      },
      signal:   controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return { body: null, status: res.status };
    const body = await res.text();
    return { body, status: res.status };
  } catch (err: any) {
    clearTimeout(timer);
    const msg =
      err.name === "AbortError"
        ? `Timed out after ${FETCH_TIMEOUT_MS / 1000}s`
        : err.message;
    return { body: null, status: 0, error: msg };
  }
}

// ── Parsing ───────────────────────────────────────────────────────────────────

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, " ")
    .trim();
}

function parseListing(raw: any): SourceListing | null {
  if (!raw || typeof raw !== "object") return null;

  // ── External ID ───────────────────────────────────────────────────────────
  const externalId = raw.id != null ? String(raw.id) : null;
  if (!externalId) return null;

  // ── Title ─────────────────────────────────────────────────────────────────
  const rawTitle = raw.title?.rendered ?? raw.slug ?? "";
  const title    = decodeHtmlEntities(rawTitle.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  if (!title) return null;

  // ── URL ───────────────────────────────────────────────────────────────────
  const url = (typeof raw.link === "string" && raw.link.startsWith("http"))
    ? raw.link
    : `${BASE_URL}/properties/${raw.slug}/`;

  // ── Image ─────────────────────────────────────────────────────────────────
  let imageUrl: string | undefined;
  const featMedia = raw._embedded?.["wp:featuredmedia"];
  if (Array.isArray(featMedia) && featMedia.length > 0) {
    const src = featMedia[0]?.source_url;
    if (typeof src === "string" && src.startsWith("http")) {
      imageUrl = src;
    }
  }

  return {
    source:     SOURCE,
    externalId,
    title,
    price:      undefined,   // not available in API
    location:   "Dublin 12",
    url,
    imageUrl,
    bedrooms:   undefined,   // Elementor dynamic field, not in API
  };
}

// ── Main fetch ────────────────────────────────────────────────────────────────

async function doFetch(): Promise<CityhomesFetchResult> {
  log(`[${SOURCE}] Fetching via direct → ${API_URL}`, SOURCE);

  const { body, status, error } = await doHttpGet(API_URL);

  if (!body) {
    if (status === 403 || status === 429) {
      log(`[${SOURCE}] HTTP ${status} — rate-limited or blocked`, SOURCE);
    } else {
      log(`[${SOURCE}] HTTP ${status}${error ? ` (${error})` : ""} — no data`, SOURCE);
    }
    return { method: "direct", status, rawCount: 0, normalizedCount: 0, listings: [], error };
  }

  let rawData: any[];
  try {
    rawData = JSON.parse(body);
    if (!Array.isArray(rawData)) {
      log(`[${SOURCE}] Unexpected JSON shape (not array)`, SOURCE);
      return { method: "direct", status, rawCount: 0, normalizedCount: 0, listings: [] };
    }
  } catch {
    log(`[${SOURCE}] Failed to parse JSON response`, SOURCE);
    return { method: "direct", status, rawCount: 0, normalizedCount: 0, listings: [] };
  }

  const rawCount = rawData.length;
  const listings: SourceListing[] = [];
  const seenIds  = new Set<string>();

  for (const item of rawData) {
    const listing = parseListing(item);
    if (!listing)                     continue;
    if (seenIds.has(listing.externalId)) continue;
    seenIds.add(listing.externalId);
    listings.push(listing);
  }

  log(
    `[${SOURCE}] Complete: raw=${rawCount} normalized=${listings.length} (direct)`,
    SOURCE,
  );

  return {
    method:          "direct",
    status,
    rawCount,
    normalizedCount: listings.length,
    listings,
  };
}

export async function fetchListings(): Promise<SourceListing[]> {
  return (await doFetch()).listings;
}

export async function testFetch(): Promise<CityhomesFetchResult> {
  return doFetch();
}
