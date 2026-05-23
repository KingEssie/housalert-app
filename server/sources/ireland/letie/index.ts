/**
 * Let.ie fetcher for Dublin rentals.
 *
 * Let.ie is powered by Daft.ie's backend (same Next.js SSR infrastructure,
 * identical __NEXT_DATA__ shape). Without JavaScript rendering it returns
 * ~8 featured FOR-SALE listings regardless of which rental URL is requested —
 * real rental search results are loaded client-side.
 *
 * To fetch real rental listings, JavaScript rendering is required. Configure:
 *   LETIE_PROXY_URL=https://api.scraperapi.com/?api_key=KEY&render=true&url=
 *
 * Without a JS-rendering proxy this fetcher returns [] (correct, no fake data).
 *
 * Note on duplicates: Let.ie shares Daft's listing IDs. When both sources
 * are active with JS rendering, the cross-source dedup engine (coordinate
 * clustering) will merge near-identical listings automatically.
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

const SOURCE_ENV   = "LETIE_PROXY_URL"; // falls back to DAFT_PROXY_URL inside proxy.ts
const LISTING_BASE = "https://www.let.ie";

// Multiple candidate URLs — Let.ie mirrors Daft URL structure for rentals
const CANDIDATE_URLS: string[] = process.env.LETIE_DUBLIN_URL
  ? [process.env.LETIE_DUBLIN_URL]
  : [
      "https://www.let.ie/property-for-rent/dublin-city/",
      "https://www.let.ie/property-for-rent/dublin/",
      "https://www.let.ie/property-for-rent/",
    ];

function extractListings(html: string, fromUrl: string): { rawCount: number; listings: SourceListing[] } {
  const { json, isCloudflare } = extractNextData(html);

  if (isCloudflare) {
    log("[letie] Cloudflare challenge detected — skipping", "letie");
    return { rawCount: 0, listings: [] };
  }

  if (json) {
    const pageProps = json?.props?.pageProps ?? {};
    const raw: any[] =
      pageProps?.listings ??
      pageProps?.rentalListings ??
      pageProps?.data?.listings ??
      pageProps?.searchResults ??
      [];

    const rawCount = Array.isArray(raw) ? raw.length : 0;
    if (rawCount === 0) {
      log(`[letie] __NEXT_DATA__ present but no listings (keys: ${Object.keys(pageProps).join(", ") || "(empty)"})`, "letie");
      return { rawCount: 0, listings: [] };
    }

    // Filter: only include actual /for-rent/ listings (Let.ie may return for-sale from Daft)
    const rentalEntries = raw.filter((entry: any) => {
      const seoPath: string =
        entry?.listing?.seoFriendlyPath ??
        entry?.listing?.listingPage ??
        entry?.listing?.url ??
        entry?.seoFriendlyPath ?? "";
      return seoPath.includes("/for-rent/") || seoPath.includes("to-rent") || seoPath.includes("rent");
    });

    if (rentalEntries.length === 0) {
      const hasRender = isJsRenderingEnabled(SOURCE_ENV);
      log(
        `[letie] ${rawCount} listings in __NEXT_DATA__ but 0 are /for-rent/ — ` +
        (hasRender
          ? "JS rendering active but returning for-sale data; URL or page structure may have changed."
          : "Without JS rendering Let.ie returns for-sale listings only. " +
            "Set LETIE_PROXY_URL=https://api.scraperapi.com/?api_key=KEY&render=true&url="),
        "letie"
      );
      return { rawCount, listings: [] };
    }

    const results: SourceListing[] = [];
    for (const entry of rentalEntries) {
      const l = entry?.listing ?? entry;
      if (!l) continue;
      const id = l.id != null ? String(l.id) : null;
      if (!id) continue;

      const seoPath: string = l.seoFriendlyPath || l.listingPage || l.url || "";
      const url = seoPath
        ? `${LISTING_BASE}${seoPath.startsWith("/") ? seoPath : "/" + seoPath}`
        : `${LISTING_BASE}/property-for-rent/dublin/${id}`;

      const title    = l.header || l.title || l.propertyType || "Dublin Rental";
      const price    = l.price ? parsePrice(String(l.price)) : undefined;
      const bedrooms = (l.numBedrooms ?? l.bedrooms) != null ? parseBedrooms(String(l.numBedrooms ?? l.bedrooms)) : undefined;
      const images: any[] = l.media?.images ?? l.photos ?? l.images ?? [];
      const imageUrl = images[0]?.size600x600 || images[0]?.size720x480 || images[0]?.url || undefined;
      const location = l.address || l.addressTown || l.town || undefined;
      const createdAt = (l.publishDate || l.listingDate) ? new Date(l.publishDate || l.listingDate) : undefined;

      let latitude: number | undefined;
      let longitude: number | undefined;
      const coords: any[] | undefined = l.point?.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        longitude = typeof coords[0] === "number" ? coords[0] : undefined;
        latitude  = typeof coords[1] === "number" ? coords[1] : undefined;
      }

      if (!title || !url) continue;
      results.push({ source: "letie", externalId: id, title, price, location, url, imageUrl, bedrooms, createdAt, latitude, longitude });
    }
    return { rawCount, listings: results };
  }

  // No __NEXT_DATA__ — SPA shell or unknown format
  const hasRender = isJsRenderingEnabled(SOURCE_ENV);
  if (!hasRender) {
    log(
      "[letie] No __NEXT_DATA__ in response — Let.ie may need JS rendering. " +
      "Set LETIE_PROXY_URL=https://api.scraperapi.com/?api_key=KEY&render=true&url=",
      "letie"
    );
  } else {
    log(`[letie] JS rendering enabled but no __NEXT_DATA__ found from ${fromUrl} — URL or page structure may have changed`, "letie");
  }
  return { rawCount: 0, listings: [] };
}

export async function fetchListings(): Promise<SourceListing[]> {
  const proxyConfigured = isProxyConfigured(SOURCE_ENV);
  const jsRendering     = isJsRenderingEnabled(SOURCE_ENV);

  for (const url of CANDIDATE_URLS) {
    log(
      `[letie] Fetching ${proxyConfigured ? `(proxy${jsRendering ? "+render" : ", no JS render"})` : "(direct)"} → ${url}`,
      "letie"
    );

    const { html, status, method, error } = await fetchPage(url, { Referer: "https://www.let.ie/" }, SOURCE_ENV);

    if (error) { log(`[letie] Fetch error (${url}): ${error}`, "letie"); continue; }
    if (!html)  { log(`[letie] HTTP ${status} from ${url} — trying next candidate`, "letie"); continue; }

    const { rawCount, listings } = extractListings(html, url);
    log(`[letie] HTTP ${status} (${method}) — raw=${rawCount} normalized=${listings.length} | ${url}`, "letie");

    // If we got real rental listings, stop here
    if (listings.length > 0) return listings;

    // If we got an HTML response but 0 rentals, no point retrying other URLs with same content
    // (Let.ie serves identical content for all /property-for-rent/* URLs)
    if (rawCount > 0) return listings;
  }

  return [];
}
