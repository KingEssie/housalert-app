/**
 * Sherry FitzGerald fetcher — Ireland rental listings.
 *
 * Sherry FitzGerald is one of Ireland's largest estate agents with branches
 * across Dublin, Cork, Galway and other major cities.
 * Their XML sitemap for rental listings is publicly accessible and updated
 * daily — no JS rendering required.
 *
 * Sitemap URL:
 *   https://www.sherryfitz.ie/sfdev/site/sitemaps/rent/sitemap.xml
 *   → ~443 total entries covering Dublin and other Irish cities.
 *
 * URL structure:
 *   https://www.sherryfitz.ie/rent/TYPE/CITY/DISTRICT/SLUG
 *   e.g. /rent/apartment/dublin/ballsbridge/4-bed-apartment-haddington-road
 *        /rent/apartment/cork/city-centre/2-bed-apartment-merchant-quay
 *
 * From the URL we extract: city, type, district, bed count, title.
 * Price is NOT available from the sitemap (individual pages are JS-rendered).
 *
 * When called with a specific city (default "Dublin") the fetcher filters to
 * that city's sitemap entries.  Dublin keeps the MAX_LISTINGS cap to avoid
 * over-representing one city; other cities return all available entries.
 */
import { log } from "../../../log";
import type { SourceListing } from "../types";
import { BROWSER_HEADERS, FETCH_TIMEOUT_MS } from "../proxy";

const SOURCE = "sherryfitz";

const SITEMAP_URL =
  process.env.SHERRYFITZ_SITEMAP_URL ||
  "https://www.sherryfitz.ie/sfdev/site/sitemaps/rent/sitemap.xml";

const LISTING_BASE = "https://www.sherryfitz.ie";

const MAX_DUBLIN_LISTINGS = parseInt(process.env.SHERRYFITZ_MAX_LISTINGS || "60", 10);

export interface SherryFitzFetchResult {
  method:          "direct";
  status:          number | null;
  rawCount:        number;
  cityCount:       number;
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

function toTitleCase(s: string): string {
  return s
    .replace(/-/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Parse a Sherry FitzGerald rental URL into listing fields.
 *
 * Path format: /rent/TYPE/CITY/DISTRICT/SLUG
 *
 * Indices after split on "/":
 *   [0] ""  → filtered
 *   [0] "rent"
 *   [1] TYPE
 *   [2] CITY   (e.g. "dublin", "cork", "galway")
 *   [3] DISTRICT
 *   [4] SLUG
 */
function parseListingFromUrl(
  fullUrl: string,
  lastmod: string,
  expectedCitySlug: string,
): SourceListing | null {
  let pathname: string;
  try {
    pathname = new URL(fullUrl).pathname;
  } catch {
    return null;
  }

  const parts = pathname.replace(/\/$/, "").split("/").filter(Boolean);
  // Expected: ["rent", TYPE, CITY, DISTRICT, SLUG]
  if (parts.length < 5 || parts[0] !== "rent") return null;

  const urlCitySlug  = parts[2]; // e.g. "dublin", "cork"
  if (urlCitySlug !== expectedCitySlug) return null;

  const propertyType = parts[1];
  const district     = parts[3];
  const slug         = parts[4];

  const externalId = `${propertyType}/${urlCitySlug}/${district}/${slug}`;

  let bedrooms: number | undefined;
  const bedsMatch = slug.match(/^(\d+)-bed/i);
  if (bedsMatch) {
    bedrooms = parseInt(bedsMatch[1], 10);
  } else if (/^studio/.test(slug)) {
    bedrooms = 0;
  }

  let addressSlug = slug;
  if (bedsMatch) {
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

  const location = districtStr;

  // Canonical city name from slug (e.g. "cork" → "Cork")
  const city = toTitleCase(urlCitySlug);

  let createdAt: Date | undefined;
  if (lastmod) {
    const d = new Date(lastmod);
    if (!isNaN(d.getTime())) createdAt = d;
  }

  return {
    source:     SOURCE,
    externalId,
    title,
    price:      undefined,
    location,
    city,
    url:        fullUrl,
    imageUrl:   undefined,
    bedrooms,
    createdAt,
  };
}

// ── Main fetch ────────────────────────────────────────────────────────────────

async function doFetch(city: string): Promise<SherryFitzFetchResult> {
  const citySlug = city.toLowerCase().replace(/\s+/g, "-");

  log(`[${SOURCE}] Fetching sitemap → ${SITEMAP_URL}`, SOURCE);

  const { body, status, error } = await doHttpGet(SITEMAP_URL);

  if (!body) {
    log(`[${SOURCE}] HTTP ${status}${error ? ` (${error})` : ""} — no data`, SOURCE);
    return { method: "direct", status, rawCount: 0, cityCount: 0, normalizedCount: 0, listings: [], error };
  }

  if (!body.includes("<urlset") && !body.includes("<loc>")) {
    log(`[${SOURCE}] Response does not look like a sitemap — discarding`, SOURCE);
    return { method: "direct", status, rawCount: 0, cityCount: 0, normalizedCount: 0, listings: [] };
  }

  const all      = parseSitemap(body);
  const rawCount = all.length;

  // Filter to this city's listings
  const cityEntries = all.filter(e => e.url.includes(`/${citySlug}/`));
  const cityCount   = cityEntries.length;

  log(`[${SOURCE}] Sitemap: ${rawCount} total, ${cityCount} ${city} entries`, SOURCE);

  if (cityCount === 0) {
    return { method: "direct", status, rawCount, cityCount: 0, normalizedCount: 0, listings: [] };
  }

  // Sort by lastmod descending (newest changes first)
  cityEntries.sort((a, b) => {
    if (!a.lastmod && !b.lastmod) return 0;
    if (!a.lastmod) return 1;
    if (!b.lastmod) return -1;
    return b.lastmod.localeCompare(a.lastmod);
  });

  // Dublin has a cap to avoid over-representing one city; other cities return all.
  const candidates =
    citySlug === "dublin"
      ? cityEntries.slice(0, MAX_DUBLIN_LISTINGS)
      : cityEntries;

  const listings: SourceListing[] = [];
  const seenIds  = new Set<string>();

  for (const entry of candidates) {
    const listing = parseListingFromUrl(entry.url, entry.lastmod, citySlug);
    if (!listing)                        continue;
    if (seenIds.has(listing.externalId)) continue;
    seenIds.add(listing.externalId);
    listings.push(listing);
  }

  log(
    `[${SOURCE}] Complete: raw=${rawCount} ${city}=${cityCount} sampled=${candidates.length} normalized=${listings.length}`,
    SOURCE,
  );

  return {
    method:          "direct",
    status,
    rawCount,
    cityCount,
    normalizedCount: listings.length,
    listings,
  };
}

export async function fetchListings(city = "Dublin"): Promise<SourceListing[]> {
  return (await doFetch(city)).listings;
}

export async function testFetch(city = "Dublin"): Promise<SherryFitzFetchResult> {
  return doFetch(city);
}
