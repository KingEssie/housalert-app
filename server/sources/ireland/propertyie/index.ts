/**
 * Property.ie fetcher for Dublin rentals.
 *
 * Property.ie (owned by Independent News & Media / News Corp Ireland) appears
 * to be fully blocked via ScraperAPI — all tested URL patterns return 404.
 * This may be because:
 *   - The site is behind Cloudflare with a strict IP allowlist
 *   - Property.ie uses a non-standard URL structure not yet found
 *   - The proxy's IP range is blocked by Property.ie
 *
 * If a working URL is found or a capable proxy becomes available, set:
 *   PROPERTYIE_PROXY_URL=https://api.scraperapi.com/?api_key=KEY&render=true&url=
 *   PROPERTYIE_DUBLIN_URL=https://www.property.ie/<correct-rental-path>/
 *
 * Without a working URL/proxy this fetcher returns [] (correct, no fake data).
 */
import { log } from "../../../log";
import type { SourceListing } from "../types";
import {
  fetchPage,
  extractNextData,
  parsePrice,
  parseBedrooms,
  isProxyConfigured,
  isJsRenderingEnabled,
} from "../proxy";

const SOURCE_ENV   = "PROPERTYIE_PROXY_URL"; // falls back to DAFT_PROXY_URL
const LISTING_BASE = "https://www.property.ie";

// Candidate rental search URLs — update PROPERTYIE_DUBLIN_URL env var if correct URL is found
const CANDIDATE_URLS: string[] = process.env.PROPERTYIE_DUBLIN_URL
  ? [process.env.PROPERTYIE_DUBLIN_URL]
  : [
      "https://www.property.ie/property-to-rent/leinster/dublin/",
      "https://www.property.ie/property-for-rent/dublin/",
      "https://www.property.ie/residential/to-rent/dublin/",
    ];

function extractListings(html: string): { rawCount: number; listings: SourceListing[] } {
  const { json, isCloudflare } = extractNextData(html);

  if (isCloudflare) {
    log("[propertyie] Cloudflare challenge detected — skipping", "propertyie");
    return { rawCount: 0, listings: [] };
  }

  if (json) {
    const pageProps = json?.props?.pageProps ?? {};
    const raw: any[] =
      pageProps?.listings ??
      pageProps?.properties ??
      pageProps?.results ??
      pageProps?.data?.listings ??
      pageProps?.searchResults ??
      [];

    const rawCount = Array.isArray(raw) ? raw.length : 0;
    if (rawCount === 0) {
      log(`[propertyie] __NEXT_DATA__ present but no listings (keys: ${Object.keys(pageProps).join(", ") || "(empty)"})`, "propertyie");
      return { rawCount: 0, listings: [] };
    }

    const results: SourceListing[] = [];
    for (const entry of raw) {
      const l = entry?.listing ?? entry?.property ?? entry;
      if (!l) continue;
      const id = l.id != null ? String(l.id) : l.propertyId != null ? String(l.propertyId) : null;
      if (!id) continue;

      const seoPath: string = l.seoFriendlyPath || l.url || l.brochureLink || "";
      const url = seoPath
        ? `${LISTING_BASE}${seoPath.startsWith("/") ? seoPath : "/" + seoPath}`
        : `${LISTING_BASE}/property-to-rent/dublin/${id}`;

      const title    = l.header || l.title || l.displayAddress || l.address || l.propertyType || "Dublin Rental";
      const price    = (l.price || l.rent || l.monthlyRent) ? parsePrice(String(l.price ?? l.rent ?? l.monthlyRent)) : undefined;
      const bedrooms = (l.numBedrooms ?? l.bedrooms ?? l.beds) != null
        ? parseBedrooms(String(l.numBedrooms ?? l.bedrooms ?? l.beds))
        : undefined;
      const images: any[] = l.media?.images ?? l.images ?? l.photos ?? [];
      const imageUrl = images[0]?.size600x600 || images[0]?.url || images[0]?.src || undefined;
      const location = l.address || l.displayAddress || l.area || l.town || undefined;
      const createdAt = (l.publishDate || l.datePosted) ? new Date(l.publishDate ?? l.datePosted) : undefined;

      let latitude: number | undefined;
      let longitude: number | undefined;
      const coords: any[] | undefined = l.point?.coordinates ?? l.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        longitude = typeof coords[0] === "number" ? coords[0] : undefined;
        latitude  = typeof coords[1] === "number" ? coords[1] : undefined;
      } else if (typeof l.latitude === "number") {
        latitude = l.latitude; longitude = l.longitude;
      }

      if (!title || !url) continue;
      results.push({ source: "propertyie", externalId: id, title, price, location, url, imageUrl, bedrooms, createdAt, latitude, longitude });
    }
    return { rawCount, listings: results };
  }

  // No structured data — log the situation
  const isClientSide = html.length < 50_000 || html.includes("window.__") || html.includes("ng-version");
  const hasRender    = isJsRenderingEnabled(SOURCE_ENV);

  if (isClientSide && !hasRender) {
    log(
      "[propertyie] Client-side app shell received — JS rendering may be required. " +
      "Set PROPERTYIE_PROXY_URL=https://api.scraperapi.com/?api_key=KEY&render=true&url=",
      "propertyie"
    );
  } else {
    log(`[propertyie] No listing data in response (${html.length} chars)`, "propertyie");
  }

  return { rawCount: 0, listings: [] };
}

export async function fetchListings(): Promise<SourceListing[]> {
  const proxyConfigured = isProxyConfigured(SOURCE_ENV);
  const jsRendering     = isJsRenderingEnabled(SOURCE_ENV);

  for (const url of CANDIDATE_URLS) {
    log(
      `[propertyie] Fetching ${proxyConfigured ? `(proxy${jsRendering ? "+render" : ", no JS render"})` : "(direct)"} → ${url}`,
      "propertyie"
    );

    const { html, status, method, error } = await fetchPage(url, { Referer: "https://www.property.ie/" }, SOURCE_ENV);

    if (error) {
      log(`[propertyie] Fetch error (${url}): ${error}`, "propertyie");
      continue;
    }
    if (!html) {
      log(
        `[propertyie] HTTP ${status} from ${url} — ` +
        (status === 404
          ? "URL not found (Property.ie URL pattern may differ from expected)"
          : "blocked or unavailable") +
        " — trying next candidate",
        "propertyie"
      );
      continue;
    }

    const { rawCount, listings } = extractListings(html);
    log(`[propertyie] HTTP ${status} (${method}) — raw=${rawCount} normalized=${listings.length} | ${url}`, "propertyie");
    if (listings.length > 0) return listings;
    if (rawCount > 0) return listings;
  }

  log(
    "[propertyie] All candidate URLs returned no usable data. " +
    "Property.ie may require a different URL format or a JS-rendering proxy. " +
    "Set PROPERTYIE_DUBLIN_URL to override the search URL.",
    "propertyie"
  );
  return [];
}
