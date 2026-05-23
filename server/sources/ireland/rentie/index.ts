/**
 * Rent.ie fetcher for Dublin rentals.
 *
 * Rent.ie is a fully client-side SPA (XHTML 1.0 + jQuery/Angular). The server
 * returns an ~80KB HTML shell with no listing data — listings are loaded via
 * JavaScript after page render.
 *
 * To fetch real listings, JavaScript rendering is required. Configure:
 *   RENTIE_PROXY_URL=https://api.scraperapi.com/?api_key=KEY&render=true&url=
 *
 * Without a JS-rendering proxy this fetcher returns [] (correct, no fake data).
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

const SOURCE_ENV = "RENTIE_PROXY_URL"; // falls back to DAFT_PROXY_URL inside proxy.ts
const BASE_URL   = process.env.RENTIE_DUBLIN_URL || "https://www.rent.ie/houses-to-rent/dublin/";
const LISTING_BASE = "https://www.rent.ie";

function extractListings(html: string): { rawCount: number; listings: SourceListing[] } {
  const { json, isCloudflare } = extractNextData(html);

  if (isCloudflare) {
    log("[rentie] Cloudflare challenge detected — skipping", "rentie");
    return { rawCount: 0, listings: [] };
  }

  // ── Path 1: __NEXT_DATA__ (present only with JS rendering) ───────────────
  if (json) {
    const pageProps = json?.props?.pageProps ?? {};
    const raw: any[] =
      pageProps?.listings ??
      pageProps?.rentalListings ??
      pageProps?.data?.listings ??
      pageProps?.searchResults ??
      pageProps?.properties ??
      [];

    const rawCount = Array.isArray(raw) ? raw.length : 0;
    if (rawCount === 0) {
      log(`[rentie] __NEXT_DATA__ present but no listings (keys: ${Object.keys(pageProps).join(", ") || "(empty)"})`, "rentie");
      return { rawCount: 0, listings: [] };
    }

    const results: SourceListing[] = [];
    for (const entry of raw) {
      const l = entry?.listing ?? entry?.property ?? entry;
      if (!l) continue;
      const id = l.id != null ? String(l.id) : null;
      if (!id) continue;
      const seoPath: string = l.seoFriendlyPath || l.slug || l.url || "";
      const url = seoPath
        ? `${LISTING_BASE}${seoPath.startsWith("/") ? seoPath : "/" + seoPath}`
        : `${LISTING_BASE}/rental-property/dublin/${id}/`;
      const title  = l.header || l.title || l.address || "Dublin Rental";
      const price  = (l.price || l.rent || l.monthlyRent) ? parsePrice(String(l.price ?? l.rent ?? l.monthlyRent)) : undefined;
      const beds   = (l.numBedrooms ?? l.bedrooms ?? l.beds) != null ? parseBedrooms(String(l.numBedrooms ?? l.bedrooms ?? l.beds)) : undefined;
      const images: any[] = l.media?.images ?? l.images ?? l.photos ?? [];
      const imageUrl = images[0]?.url || images[0]?.src || undefined;
      const location = l.address || l.area || l.town || undefined;
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
      results.push({ source: "rentie", externalId: id, title, price, location, url, imageUrl, bedrooms: beds, createdAt, latitude, longitude });
    }
    return { rawCount, listings: results };
  }

  // ── Path 2: HTML fallback (rental property link extraction) ──────────────
  // Only present when JS rendering executed and loaded the SPA
  const rentalLinks = [...html.matchAll(/href="(\/rental-property\/[^"]+\/(\d+)\/?)"/g)];
  if (rentalLinks.length > 0) {
    const seen = new Set<string>();
    const results: SourceListing[] = [];
    for (const m of rentalLinks) {
      const path = m[1];
      const id   = m[2];
      if (seen.has(id)) continue;
      seen.add(id);
      const url   = `${LISTING_BASE}${path}`;
      const title = `Dublin Rental #${id}`;
      results.push({ source: "rentie", externalId: id, title, url });
    }
    log(`[rentie] Extracted ${results.length} listings via HTML link parsing`, "rentie");
    return { rawCount: results.length, listings: results };
  }

  // ── No data ──────────────────────────────────────────────────────────────
  const isClientSideShell =
    html.includes("XHTML 1.0 Strict") || html.includes("tealiumTrackByConfig") || html.length < 100_000;

  if (isClientSideShell) {
    const hasRender = isJsRenderingEnabled(SOURCE_ENV);
    if (!hasRender) {
      log(
        "[rentie] Client-side SPA shell received — JS rendering required. " +
        "Set RENTIE_PROXY_URL=https://api.scraperapi.com/?api_key=KEY&render=true&url=",
        "rentie"
      );
    } else {
      log("[rentie] JS rendering enabled but SPA did not populate listings — page structure may have changed", "rentie");
    }
  } else {
    log(`[rentie] No listing data found in response (${html.length} chars)`, "rentie");
  }

  return { rawCount: 0, listings: [] };
}

export async function fetchListings(): Promise<SourceListing[]> {
  const proxyConfigured = isProxyConfigured(SOURCE_ENV);
  const jsRendering = isJsRenderingEnabled(SOURCE_ENV);

  log(
    `[rentie] Fetching ${proxyConfigured ? `(proxy${jsRendering ? "+render" : ", no JS render"})` : "(direct)"} → ${BASE_URL}`,
    "rentie"
  );

  const { html, status, method, error } = await fetchPage(BASE_URL, { Referer: "https://www.rent.ie/" }, SOURCE_ENV);

  if (error) { log(`[rentie] Fetch error: ${error}`, "rentie"); return []; }
  if (!html) { log(`[rentie] HTTP ${status} — skipping`, "rentie"); return []; }

  const { rawCount, listings } = extractListings(html);
  log(`[rentie] HTTP ${status} (${method}) — raw=${rawCount} normalized=${listings.length}`, "rentie");
  return listings;
}
