import { log } from "../../../log";
import type { SourceListing } from "../types";
import {
  buildProxyUrl,
  isProxyConfigured,
  BROWSER_HEADERS,
  FETCH_TIMEOUT_MS,
  extractNextData,
  parsePrice,
  parseBedrooms,
} from "../proxy";

const SOURCE_ENV = "DAFT_PROXY_URL";
const BASE_URL   =
  process.env.DAFT_DUBLIN_RENT_URL ||
  "https://www.daft.ie/property-for-rent/dublin-city";

export interface DaftFetchResult {
  method: "direct" | "proxy";
  proxyConfigured: boolean;
  status: number | null;
  rawCount: number;
  normalizedCount: number;
  listings: SourceListing[];
  error?: string;
}

function extractListings(html: string): { rawCount: number; listings: SourceListing[] } {
  const { json, isCloudflare } = extractNextData(html);

  if (!json) {
    if (isCloudflare) {
      log("[daft] Cloudflare challenge page detected — skipping this cycle", "daft");
    } else {
      const snippet = html.slice(0, 200).replace(/\s+/g, " ").trim();
      log(`[daft] No __NEXT_DATA__ in response (snippet: ${snippet})`, "daft");
    }
    return { rawCount: 0, listings: [] };
  }

  const pageProps = json?.props?.pageProps ?? {};
  const rawListings: any[] =
    pageProps?.listings ??
    pageProps?.data?.listings ??
    pageProps?.searchResults?.listings ??
    pageProps?.props?.listings ??
    [];

  const rawCount = Array.isArray(rawListings) ? rawListings.length : 0;
  if (rawCount === 0) {
    const keys = Object.keys(pageProps).join(", ") || "(empty)";
    log(`[daft] __NEXT_DATA__ found but no listings array (pageProps keys: ${keys})`, "daft");
    return { rawCount: 0, listings: [] };
  }

  const results: SourceListing[] = [];
  for (const entry of rawListings) {
    const l = entry?.listing ?? entry;
    if (!l) continue;
    const id = l.id != null ? String(l.id) : null;
    if (!id) continue;

    const seoPath: string = l.seoFriendlyPath || l.listingPage || "";
    const url = seoPath
      ? `https://www.daft.ie${seoPath.startsWith("/") ? seoPath : "/" + seoPath}`
      : `https://www.daft.ie/property-for-rent/dublin/${id}`;

    const title: string = l.header || l.title || l.propertyType || "Dublin Rental";
    const price    = l.price ? parsePrice(l.price) : undefined;
    const bedrooms = (l.numBedrooms || l.bedrooms) ? parseBedrooms(l.numBedrooms || l.bedrooms) : undefined;

    // Floor area — Daft __NEXT_DATA__ may include floorArea as object or number
    const size_m2: number | undefined = (() => {
      const fa = l.floorArea ?? l.floor_area ?? l.size ?? l.area;
      if (typeof fa === "number") return fa > 0 ? Math.round(fa) : undefined;
      if (fa && typeof fa === "object") {
        const v = fa.value ?? fa.size ?? fa.sqm ?? fa.area;
        const u = (fa.unit ?? fa.unitType ?? "").toString().toLowerCase();
        if (typeof v === "number" && v > 0) {
          if (u.includes("ft") || u.includes("foot") || u.includes("feet")) {
            return Math.round(v * 0.0929);
          }
          return Math.round(v);
        }
      }
      return undefined;
    })();

    const images: any[] = l.media?.images ?? l.photos ?? [];
    const imageUrl: string | undefined =
      images[0]?.size600x600 || images[0]?.size720x480 || images[0]?.size360x240 || images[0]?.url || undefined;

    const location: string | undefined = l.address || l.addressTown || l.town || undefined;
    const createdAt = (l.publishDate || l.listingDate) ? new Date(l.publishDate || l.listingDate) : undefined;

    let latitude: number | undefined;
    let longitude: number | undefined;
    const coords: any[] | undefined = l.point?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      longitude = typeof coords[0] === "number" ? coords[0] : undefined;
      latitude  = typeof coords[1] === "number" ? coords[1] : undefined;
    }

    if (!title || !url) continue;
    results.push({ source: "daft", externalId: id, title, price, location, url, imageUrl, bedrooms, size_m2, createdAt, latitude, longitude });
  }

  return { rawCount, listings: results };
}

async function doFetch(): Promise<DaftFetchResult> {
  const proxyConfigured = isProxyConfigured(SOURCE_ENV);
  const { fetchUrl, method, proxyUrl } = buildProxyUrl(BASE_URL, SOURCE_ENV);

  log(
    `[daft] Fetching via ${method}${proxyUrl ? ` (proxy: ${proxyUrl.slice(0, 40)}…)` : ""} → ${BASE_URL}`,
    "daft"
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let status: number | null = null;

  try {
    const res = await fetch(fetchUrl, {
      headers: { ...BROWSER_HEADERS, Referer: "https://www.daft.ie/" },
      signal:  controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    status = res.status;

    if (res.status === 403 || res.status === 503) {
      const note = method === "proxy" ? " (proxy did not bypass CF)" : "";
      log(`[daft] HTTP ${res.status} — Cloudflare block${note}, skipping`, "daft");
      return { method, proxyConfigured, status, rawCount: 0, normalizedCount: 0, listings: [] };
    }
    if (!res.ok) {
      log(`[daft] HTTP ${res.status} ${res.statusText} — skipping`, "daft");
      return { method, proxyConfigured, status, rawCount: 0, normalizedCount: 0, listings: [] };
    }

    const html = await res.text();
    const { rawCount, listings } = extractListings(html);
    log(`[daft] HTTP ${status} (${method}) — raw=${rawCount} normalized=${listings.length}`, "daft");
    return { method, proxyConfigured, status, rawCount, normalizedCount: listings.length, listings };
  } catch (err: any) {
    clearTimeout(timer);
    const msg = err.name === "AbortError" ? `Timed out after ${FETCH_TIMEOUT_MS / 1000}s` : `Fetch error: ${err.message}`;
    log(`[daft] ${msg}`, "daft");
    return { method, proxyConfigured, status, rawCount: 0, normalizedCount: 0, listings: [], error: msg };
  }
}

export async function fetchListings(): Promise<SourceListing[]> {
  return (await doFetch()).listings;
}

export async function testFetch(): Promise<DaftFetchResult> {
  return doFetch();
}
