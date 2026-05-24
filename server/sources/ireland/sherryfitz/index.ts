/**
 * Sherry FitzGerald fetcher for Dublin rentals.
 *
 * Sherry FitzGerald (sherryfitz.ie) is one of Ireland's largest estate agents.
 * Their XML sitemap for rental listings is publicly accessible and updated
 * daily with <lastmod> timestamps — no JS rendering required.
 *
 * Sitemap URL:
 *   https://www.sherryfitz.ie/sfdev/site/sitemaps/rent/sitemap.xml
 *   → 443 total entries, ~380 with /dublin/ in the URL.
 *
 * URL structure:
 *   https://www.sherryfitz.ie/rent/TYPE/dublin/DISTRICT/SLUG
 *   e.g. /rent/apartment/dublin/ballsbridge/4-bed-apartment-haddington-road
 *
 * From the URL we can extract:
 *   - property type (apartment, house, studio, semi-detached-house, etc.)
 *   - Dublin district (ballsbridge, rathmines, ranelagh, etc.)
 *   - bed count (e.g. slug starts with "4-bed-")
 *   - listing title (from slug, human-readable address)
 *
 * Price is NOT available from the sitemap (individual pages are JS-rendered).
 * We take the top MAX_LISTINGS most-recently-modified Dublin entries so that
 * new listings surfaced by Sherry FitzGerald appear quickly.
 *
 * Direct Node.js fetch works. No proxy required.
 */
import { log } from "../../../log";
import type { SourceListing } from "../types";
import { BROWSER_HEADERS, FETCH_TIMEOUT_MS } from "../proxy";

const SOURCE = "sherryfitz";

const SITEMAP_URL =
  process.env.SHERRYFITZ_SITEMAP_URL ||
  "https://www.sherryfitz.ie/sfdev/site/sitemaps/rent/sitemap.xml";

const LISTING_BASE = "https://www.sherryfitz.ie";

/** Maximum number of Dublin listings to return per cycle (most recently modified). */
const MAX_LISTINGS = parseInt(process.env.SHERRYFITZ_MAX_LISTINGS || "60", 10);

export interface SherryFitzFetchResult {
  method:          "direct";
  status:          number | null;
  rawCount:        number;
  dublinCount:     number;
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
        Accept: "application/xml,text/xml,*/*;q=0.9",
        Referer: `${LISTING_BASE}/`,
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

// ── Sitemap parsing ───────────────────────────────────────────────────────────

interface SitemapEntry {
  url:     string;
  lastmod: string;
}

function parseSitemap(xml: string): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  // Match <url>...<loc>URL</loc>...<lastmod>DATE</lastmod>...</url> blocks
  const urlBlockRe = /<url>([\s\S]*?)<\/url>/g;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = urlBlockRe.exec(xml)) !== null) {
    const block = blockMatch[1];
    const locM  = block.match(/<loc>\s*([^<]+)\s*<\/loc>/);
    const lmM   = block.match(/<lastmod>\s*([^<]+)\s*<\/lastmod>/);
    if (!locM) continue;

    entries.push({
      url:     locM[1].trim(),
      lastmod: lmM ? lmM[1].trim() : "",
    });
  }

  return entries;
}

// ── URL → listing data ────────────────────────────────────────────────────────

/**
 * Capitalise each word, replace hyphens with spaces.
 * E.g. "ballsbridge" → "Ballsbridge", "city-centre" → "City Centre"
 */
function toTitleCase(s: string): string {
  return s
    .replace(/-/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Parse a Sherry FitzGerald rental URL into listing fields.
 *
 * Path format: /rent/TYPE/dublin/DISTRICT/SLUG
 *
 * Indices after split on "/":
 *   [0] ""
 *   [1] "rent"
 *   [2] TYPE
 *   [3] "dublin"
 *   [4] DISTRICT
 *   [5] SLUG
 */
function parseListingFromUrl(
  fullUrl: string,
  lastmod: string,
): SourceListing | null {
  let pathname: string;
  try {
    pathname = new URL(fullUrl).pathname;
  } catch {
    return null;
  }

  // Strip trailing slash, split
  const parts = pathname.replace(/\/$/, "").split("/").filter(Boolean);
  // Expected: ["rent", TYPE, "dublin", DISTRICT, SLUG]
  if (parts.length < 5 || parts[0] !== "rent" || parts[2] !== "dublin") return null;

  const propertyType = parts[1]; // e.g. "apartment", "house", "studio"
  const district     = parts[3]; // e.g. "ballsbridge", "rathmines"
  const slug         = parts[4]; // address-based slug

  // ── External ID ───────────────────────────────────────────────────────────
  // Use the 3 path segments after /rent/ as a stable unique key
  const externalId = `${propertyType}/${district}/${slug}`;

  // ── Bedrooms ──────────────────────────────────────────────────────────────
  // Many slugs embed bed count: "4-bed-apartment-...", "studio-...", "1-bed-..."
  let bedrooms: number | undefined;
  const bedsMatch = slug.match(/^(\d+)-bed/i);
  if (bedsMatch) {
    bedrooms = parseInt(bedsMatch[1], 10);
  } else if (/^studio/.test(slug)) {
    bedrooms = 0;
  }

  // ── Title ─────────────────────────────────────────────────────────────────
  // Build a human-readable title from the slug, stripping bed prefix if already noted
  let addressSlug = slug;
  if (bedsMatch) {
    // Strip "N-bed-TYPE-" prefix from address slug so we don't duplicate info
    addressSlug = slug.replace(/^\d+-bed-[a-z-]+-/, "").replace(/^\d+-bed-/, "");
  }
  const addressStr  = toTitleCase(addressSlug);
  const districtStr = toTitleCase(district);
  const typeStr     = toTitleCase(propertyType);

  let title: string;
  if (bedrooms !== undefined && bedrooms > 0) {
    title = `${bedrooms} Bed ${typeStr} - ${addressStr}`;
  } else if (bedrooms === 0) {
    title = `Studio - ${addressStr}`;
  } else {
    title = `${typeStr} - ${addressStr}`;
  }

  // ── Location ──────────────────────────────────────────────────────────────
  const location = districtStr;

  // ── createdAt (use lastmod as proxy) ─────────────────────────────────────
  let createdAt: Date | undefined;
  if (lastmod) {
    const d = new Date(lastmod);
    if (!isNaN(d.getTime())) createdAt = d;
  }

  return {
    source:     SOURCE,
    externalId,
    title,
    price:      undefined,   // individual listing pages are JS-rendered; no price from sitemap
    location,
    url:        fullUrl,
    imageUrl:   undefined,   // not in sitemap
    bedrooms,
    createdAt,
  };
}

// ── Main fetch ────────────────────────────────────────────────────────────────

async function doFetch(): Promise<SherryFitzFetchResult> {
  log(`[${SOURCE}] Fetching sitemap → ${SITEMAP_URL}`, SOURCE);

  const { body, status, error } = await doHttpGet(SITEMAP_URL);

  if (!body) {
    log(`[${SOURCE}] HTTP ${status}${error ? ` (${error})` : ""} — no data`, SOURCE);
    return { method: "direct", status, rawCount: 0, dublinCount: 0, normalizedCount: 0, listings: [], error };
  }

  // Sanity-check: must look like a sitemap
  if (!body.includes("<urlset") && !body.includes("<loc>")) {
    log(`[${SOURCE}] Response does not look like a sitemap — discarding`, SOURCE);
    return { method: "direct", status, rawCount: 0, dublinCount: 0, normalizedCount: 0, listings: [] };
  }

  const all     = parseSitemap(body);
  const rawCount = all.length;

  // Filter to Dublin listings
  const dublinEntries = all.filter(e => e.url.includes("/dublin/"));
  const dublinCount   = dublinEntries.length;

  log(`[${SOURCE}] Sitemap: ${rawCount} total, ${dublinCount} Dublin entries`, SOURCE);

  if (dublinCount === 0) {
    return { method: "direct", status, rawCount, dublinCount: 0, normalizedCount: 0, listings: [] };
  }

  // Sort by lastmod descending (newest changes first) so we pick up new listings
  dublinEntries.sort((a, b) => {
    if (!a.lastmod && !b.lastmod) return 0;
    if (!a.lastmod) return 1;
    if (!b.lastmod) return -1;
    return b.lastmod.localeCompare(a.lastmod);
  });

  // Take the top MAX_LISTINGS most recently modified
  const candidates = dublinEntries.slice(0, MAX_LISTINGS);

  const listings: SourceListing[] = [];
  const seenIds  = new Set<string>();

  for (const entry of candidates) {
    const listing = parseListingFromUrl(entry.url, entry.lastmod);
    if (!listing)                     continue;
    if (seenIds.has(listing.externalId)) continue;
    seenIds.add(listing.externalId);
    listings.push(listing);
  }

  log(
    `[${SOURCE}] Complete: raw=${rawCount} dublin=${dublinCount} sampled=${candidates.length} normalized=${listings.length}`,
    SOURCE,
  );

  return {
    method:          "direct",
    status,
    rawCount,
    dublinCount,
    normalizedCount: listings.length,
    listings,
  };
}

export async function fetchListings(): Promise<SourceListing[]> {
  return (await doFetch()).listings;
}

export async function testFetch(): Promise<SherryFitzFetchResult> {
  return doFetch();
}
