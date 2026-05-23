/**
 * MyHome.ie fetcher for Dublin rentals.
 *
 * MyHome.ie is an Angular Universal SSR app. The server-side rendered HTML
 * contains only a fixed set of ~40 "featured" properties (not search results)
 * and no accessible JSON API. Real search results are loaded client-side via
 * JavaScript after hydration.
 *
 * To fetch real rental listings, JavaScript rendering is required. Configure:
 *   MYHOME_PROXY_URL=https://api.scraperapi.com/?api_key=KEY&render=true&url=
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

const SOURCE_ENV   = "MYHOME_PROXY_URL"; // falls back to DAFT_PROXY_URL inside proxy.ts
const BASE_URL     = process.env.MYHOME_DUBLIN_URL || "https://www.myhome.ie/residential/search?term=Dublin&transactionType=3";
const LISTING_BASE = "https://www.myhome.ie";

function extractListings(html: string): { rawCount: number; listings: SourceListing[] } {
  const { json, isCloudflare } = extractNextData(html);

  if (isCloudflare) {
    log("[myhome] Cloudflare challenge detected — skipping", "myhome");
    return { rawCount: 0, listings: [] };
  }

  // ── Path 1: __NEXT_DATA__ (present only with JS rendering on Next.js sites) ─
  if (json) {
    const pageProps = json?.props?.pageProps ?? {};
    const raw: any[] =
      pageProps?.listings ??
      pageProps?.properties ??
      pageProps?.searchResults?.listings ??
      pageProps?.searchResults ??
      pageProps?.data?.listings ??
      pageProps?.results ??
      pageProps?.items ??
      [];

    const rawCount = Array.isArray(raw) ? raw.length : 0;
    if (rawCount === 0) {
      log(`[myhome] __NEXT_DATA__ present but no listings (keys: ${Object.keys(pageProps).join(", ") || "(empty)"})`, "myhome");
      return { rawCount: 0, listings: [] };
    }

    const results: SourceListing[] = [];
    for (const entry of raw) {
      const l = entry?.listing ?? entry?.property ?? entry;
      if (!l) continue;
      const id = l.id != null ? String(l.id) : l.propertyId != null ? String(l.propertyId) : null;
      if (!id) continue;
      const seoPath: string = l.seoFriendlyPath || l.brochureLink || l.url || "";
      const url = seoPath
        ? `${LISTING_BASE}${seoPath.startsWith("/") ? seoPath : "/" + seoPath}`
        : `${LISTING_BASE}/residential/brochure/property/${id}`;
      const title   = l.displayAddress || l.address || l.header || l.propertyType || "Dublin Rental";
      const priceRaw = l.price ?? l.rent ?? l.monthlyRent ?? l.rentalPrice ?? "";
      const price   = priceRaw ? parsePrice(String(priceRaw)) : undefined;
      const bedsRaw = l.numBedrooms ?? l.bedrooms ?? l.beds ?? "";
      const bedrooms = bedsRaw !== "" ? parseBedrooms(String(bedsRaw)) : undefined;
      const images: any[] = l.media?.images ?? l.images ?? l.photos ?? [];
      const imageUrl = images[0]?.size600x600 || images[0]?.url || images[0]?.src || l.mainPhoto || undefined;
      const location = l.address || l.displayAddress || l.area || l.town || undefined;
      const createdAt = (l.publishDate || l.datePublished) ? new Date(l.publishDate ?? l.datePublished) : undefined;

      let latitude: number | undefined;
      let longitude: number | undefined;
      const coords: any[] | undefined = l.point?.coordinates ?? l.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        longitude = typeof coords[0] === "number" ? coords[0] : undefined;
        latitude  = typeof coords[1] === "number" ? coords[1] : undefined;
      } else if (typeof l.latitude === "number") {
        latitude = l.latitude; longitude = l.longitude;
      } else if (typeof l.lat === "number") {
        latitude = l.lat; longitude = l.lng;
      }

      if (!title || !url) continue;
      results.push({ source: "myhome", externalId: id, title, price, location, url, imageUrl, bedrooms, createdAt, latitude, longitude });
    }
    return { rawCount, listings: results };
  }

  // ── Path 2: Angular SSR with hydrated rental listing links ──────────────
  // DISABLED: with render=true MyHome redirects to the homepage which shows
  // featured FOR-SALE properties (not rental search results). Any brochure
  // links found in that response are for-sale listings from Cork, Wicklow, etc.
  // — not Dublin rentals. Returning them would insert bad data into the DB.
  //
  // Rental-specific signals we would need to trust Path 2:
  //   - HTML contains "transactionType=3" (rental search param preserved)
  //   - HTML contains "to-let" or "for-rent" page context
  // Without these signals we cannot distinguish rental vs for-sale results.
  const brochureLinks = [...html.matchAll(/href="(\/residential\/brochure\/[^"]+\/(\d+))"/g)];
  const uniqueLinks = [...new Map(brochureLinks.map(m => [m[2], m])).values()];

  if (uniqueLinks.length > 0 && isJsRenderingEnabled(SOURCE_ENV)) {
    // Validate that these links come from a RENTAL search result page, not
    // the homepage. Presence of the rental transaction type in the HTML is
    // the strongest signal we can check without fetching each listing.
    const isRentalPage = html.includes("transactionType=3")
      || html.includes("transaction-type-3")
      || html.includes('"transactionTypeId":3')
      || html.includes("to-let")
      || html.includes('"propertyType":"Apartment to Let"')
      || html.includes('"propertyType":"House to Let"');

    if (!isRentalPage) {
      log(
        `[myhome] ${uniqueLinks.length} brochure link(s) found but page lacks rental signals ` +
        "(likely homepage redirect — contains for-sale featured properties, not search results). " +
        "Discarding to prevent inserting for-sale listings as rentals.",
        "myhome"
      );
      // Fall through to the "no actionable data" block below
    } else {
      const results: SourceListing[] = [];
      for (const m of uniqueLinks) {
        const path = m[1];
        const id   = m[2];
        const url  = `${LISTING_BASE}${path}`;
        const slugTitle = path.split("/").slice(-2, -1)[0]?.replace(/-/g, " ") ?? "Dublin Rental";
        const title = slugTitle.charAt(0).toUpperCase() + slugTitle.slice(1);
        results.push({ source: "myhome", externalId: id, title, url });
      }
      log(`[myhome] Extracted ${results.length} rental listings via Angular SSR link parsing`, "myhome");
      return { rawCount: results.length, listings: results };
    }
  }

  // ── No actionable data ───────────────────────────────────────────────────
  const isAngularShell = html.includes("ng-version") || html.includes("app-root");
  const hasRender = isJsRenderingEnabled(SOURCE_ENV);

  if (isAngularShell && !hasRender) {
    log(
      "[myhome] Angular SSR shell received — JS rendering required for search results. " +
      "Set MYHOME_PROXY_URL=https://api.scraperapi.com/?api_key=KEY&render=true&url=",
      "myhome"
    );
  } else if (!hasRender) {
    log(`[myhome] No listing data found (${html.length} chars) — JS rendering may be required`, "myhome");
  } else {
    // render=true returns the homepage/featured properties (SaleTypeId=17, prices ~€800k+)
    // regardless of the transactionType=3 search param. MyHome.ie redirects to its
    // homepage on first visit via ScraperAPI; the search param is dropped.
    // A session cookie or direct API access would be needed to reach rental search results.
    log(
      "[myhome] JS rendering active but returning homepage (for-sale listings, SaleTypeId=17) " +
      `(${html.length} chars). MyHome.ie ignores transactionType=3 on first render — ` +
      "a pre-seeded session cookie is required to reach rental search results.",
      "myhome"
    );
  }

  return { rawCount: 0, listings: [] };
}

export async function fetchListings(): Promise<SourceListing[]> {
  const proxyConfigured = isProxyConfigured(SOURCE_ENV);
  const jsRendering = isJsRenderingEnabled(SOURCE_ENV);

  log(
    `[myhome] Fetching ${proxyConfigured ? `(proxy${jsRendering ? "+render" : ", no JS render"})` : "(direct)"} → ${BASE_URL}`,
    "myhome"
  );

  const { html, status, method, error } = await fetchPage(BASE_URL, { Referer: "https://www.myhome.ie/" }, SOURCE_ENV);

  if (error) { log(`[myhome] Fetch error: ${error}`, "myhome"); return []; }
  if (!html) { log(`[myhome] HTTP ${status} — skipping`, "myhome"); return []; }

  const { rawCount, listings } = extractListings(html);
  log(`[myhome] HTTP ${status} (${method}) — raw=${rawCount} normalized=${listings.length}`, "myhome");
  return listings;
}
