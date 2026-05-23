import { log } from "../../../log";
import type { SourceListing } from "../types";

const BASE_URL =
  process.env.DAFT_DUBLIN_RENT_URL ||
  "https://www.daft.ie/property-for-rent/dublin-city";

const FETCH_TIMEOUT_MS = 20_000;

const FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-IE,en;q=0.9",
  "Cache-Control": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
};

function parsePrice(raw: string): number | undefined {
  const cleaned = raw.replace(/[€,\s]/g, "");
  const m = cleaned.match(/(\d{3,6})/);
  if (!m) return undefined;
  const num = parseInt(m[1], 10);
  return isNaN(num) || num <= 50 ? undefined : num;
}

function parseBedrooms(raw: string): number | undefined {
  if (/studio/i.test(raw)) return 0;
  const m = raw.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : undefined;
}

function extractFromNextData(html: string): SourceListing[] {
  const scriptMatch = html.match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>\s*(\{[\s\S]+?\})\s*<\/script>/
  );
  if (!scriptMatch) {
    if (html.includes("cf-browser-verification") || html.includes("Cloudflare")) {
      log("[daft] Cloudflare challenge page detected — skipping this cycle", "daft");
    } else {
      log("[daft] No __NEXT_DATA__ found in response", "daft");
    }
    return [];
  }

  let json: any;
  try {
    json = JSON.parse(scriptMatch[1]);
  } catch (err: any) {
    log(`[daft] JSON parse error: ${err.message}`, "daft");
    return [];
  }

  const pageProps = json?.props?.pageProps ?? {};

  // Daft has returned listings at various paths across versions
  const rawListings: any[] =
    pageProps?.listings ??
    pageProps?.data?.listings ??
    pageProps?.searchResults?.listings ??
    [];

  if (!Array.isArray(rawListings) || rawListings.length === 0) {
    log(`[daft] __NEXT_DATA__ found but no listings array (keys: ${Object.keys(pageProps).join(", ")})`, "daft");
    return [];
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

    const title: string =
      l.header ||
      l.title ||
      l.propertyType ||
      "Dublin Rental";

    const priceRaw: string = l.price || "";
    const price = priceRaw ? parsePrice(priceRaw) : undefined;

    const bedroomsRaw: string = l.numBedrooms || l.bedrooms || "";
    const bedrooms = bedroomsRaw ? parseBedrooms(bedroomsRaw) : undefined;

    const images: any[] = l.media?.images ?? l.photos ?? [];
    const imageUrl: string | undefined =
      images[0]?.size600x600 ||
      images[0]?.size720x480 ||
      images[0]?.size360x240 ||
      images[0]?.url ||
      undefined;

    const location: string | undefined =
      l.address ||
      l.addressTown ||
      l.town ||
      undefined;

    const publishRaw: string = l.publishDate || l.listingDate || "";
    const createdAt = publishRaw ? new Date(publishRaw) : undefined;

    // Daft coordinates: point.coordinates = [longitude, latitude]
    let latitude: number | undefined;
    let longitude: number | undefined;
    const coords: any[] | undefined = l.point?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      longitude = typeof coords[0] === "number" ? coords[0] : undefined;
      latitude  = typeof coords[1] === "number" ? coords[1] : undefined;
    }

    if (!title || !url || !id) continue;

    results.push({
      source:     "daft",
      externalId: id,
      title,
      price,
      location,
      url,
      imageUrl,
      bedrooms,
      createdAt,
      latitude,
      longitude,
    });
  }

  return results;
}

export async function fetchListings(): Promise<SourceListing[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let html: string;
  try {
    const res = await fetch(BASE_URL, {
      headers: FETCH_HEADERS,
      signal:  controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);

    if (res.status === 403 || res.status === 503) {
      log(`[daft] HTTP ${res.status} — likely Cloudflare block, skipping`, "daft");
      return [];
    }
    if (!res.ok) {
      log(`[daft] HTTP ${res.status} ${res.statusText} — skipping`, "daft");
      return [];
    }

    html = await res.text();
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      log(`[daft] Fetch timed out after ${FETCH_TIMEOUT_MS / 1000}s`, "daft");
    } else {
      log(`[daft] Fetch error: ${err.message}`, "daft");
    }
    return [];
  }

  const listings = extractFromNextData(html);
  log(`[daft] Parsed ${listings.length} listings from ${BASE_URL}`, "daft");
  return listings;
}
