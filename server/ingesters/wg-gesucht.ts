import { log } from "../log";
import type { Ingester, IngestionResult } from "./types";
import type { ParsedListing } from "./matching";
import { insertAndMatchListings } from "./matching";
import { getCitySlugs } from "./city-slugs";
import { extractGarden, extractBath, extractRoofTerrace, extractParking, extractEnergyLabel, extractPropertyTypeFromText } from "./feature-extraction";

const WG_GESUCHT_BASE = "https://www.wg-gesucht.de";
const API_BASE = `${WG_GESUCHT_BASE}/api/asset/offers/`;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const PAGES_TO_FETCH = 3;
const PAGE_SIZE = 25;
const PAGE_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 2000;

const UNFURNISHED_PATTERNS = /unmöbliert|unfurnished|nicht\s*möbliert/i;
const FURNISHED_PATTERNS = /möbliert|furnished|teilmöbliert|voll\s*möbliert/i;
const NO_PETS_PATTERNS =
  /keine\s*haustiere|keine\s*tiere|no\s*pets|haustiere\s*nicht\s*erlaubt|tiere\s*nicht\s*erlaubt/i;
const PETS_PATTERNS = /haustier|pet|tiere?\s*erlaubt/i;
const NO_BALCONY_PATTERNS = /kein(en?)?\s*balkon|ohne\s*balkon|no\s*balcony/i;
const BALCONY_PATTERNS = /balkon|balcony|terrasse|loggia/i;
const TERRACE_LOGGIA_PATTERNS = /terrasse|loggia/i;
const NO_ELEVATOR_PATTERNS = /kein(en?)?\s*(aufzug|fahrstuhl|lift)|ohne\s*(aufzug|fahrstuhl|lift)|no\s*elevator/i;
const ELEVATOR_PATTERNS = /aufzug|fahrstuhl|elevator|lift/i;

function extractBalcony(text: string): boolean | null {
  const hasNegative = NO_BALCONY_PATTERNS.test(text);
  const hasPositive = BALCONY_PATTERNS.test(text);
  if (!hasPositive) return null;
  if (hasNegative && TERRACE_LOGGIA_PATTERNS.test(text)) return true;
  if (hasNegative) return false;
  return true;
}

function extractElevator(text: string): boolean | null {
  const hasNegative = NO_ELEVATOR_PATTERNS.test(text);
  const hasPositive = ELEVATOR_PATTERNS.test(text);
  if (!hasPositive) return null;
  if (hasNegative) return false;
  return true;
}

function extractFeatures(text: string): {
  furnished: boolean | null;
  pets_allowed: boolean | null;
  balcony: boolean | null;
  elevator: boolean | null;
  garden: boolean | null;
  bath: boolean | null;
  roof_terrace: boolean | null;
  parking: boolean | null;
  energy_label: string | null;
  property_type: string | null;
} {
  return {
    furnished: UNFURNISHED_PATTERNS.test(text)
      ? false
      : FURNISHED_PATTERNS.test(text)
        ? true
        : null,
    pets_allowed: NO_PETS_PATTERNS.test(text)
      ? false
      : PETS_PATTERNS.test(text)
        ? true
        : null,
    balcony: extractBalcony(text),
    elevator: extractElevator(text),
    garden: extractGarden(text),
    bath: extractBath(text),
    roof_terrace: extractRoofTerrace(text),
    parking: extractParking(text),
    energy_label: extractEnergyLabel(text),
    property_type: extractPropertyTypeFromText(text),
  };
}

interface WgOffer {
  offer_id: string;
  category: string;
  total_costs: string;
  property_size: string;
  number_of_rooms: string;
  offer_title: string;
  city_id: string;
  rent_type: string;
  district_custom: string;
  postcode: string;
  town_name: string;
  deactivated: string;
  geo_latitude: string;
  geo_longitude: string;
  street: string;
  offer_in_exchange: string;
}

interface WgApiResponse {
  total_items: string;
  page_number: string;
  number_of_pages: string;
  _embedded: { offers: WgOffer[] };
}

function buildListingUrl(offer: WgOffer): string {
  return `${WG_GESUCHT_BASE}/${offer.offer_id}.html`;
}

function wgCategoryToPropertyType(category: string): string | null {
  switch (category) {
    case "0": return "room";
    case "1": return "studio";
    case "2": return "apartment";
    case "3": return "house";
    default: return null;
  }
}

function offerToListing(offer: WgOffer, city: string): ParsedListing | null {
  if (offer.deactivated === "1") return null;
  if (offer.offer_in_exchange === "1") return null;

  const title = (offer.offer_title || "").trim();
  if (!title) return null;

  const price = parseInt(offer.total_costs, 10) || 0;
  const size = parseInt(offer.property_size, 10) || 0;
  const rooms = parseInt(offer.number_of_rooms, 10) || 0;

  const lat = parseFloat(offer.geo_latitude) || null;
  const lng = parseFloat(offer.geo_longitude) || null;

  const district = (offer.district_custom || "").trim() || null;
  const features = extractFeatures(title);

  const propertyType = features.property_type || wgCategoryToPropertyType(offer.category);
  const targetCategories = propertyType ? [propertyType] : null;

  return {
    title,
    url: buildListingUrl(offer),
    city,
    price,
    bedrooms: rooms,
    size_m2: size,
    source: "wg-gesucht",
    source_id: offer.offer_id,
    image_url: null,
    furnished: features.furnished,
    pets_allowed: features.pets_allowed,
    balcony: features.balcony,
    elevator: features.elevator,
    garden: features.garden,
    bath: features.bath,
    roof_terrace: features.roof_terrace,
    parking: features.parking,
    energy_label: features.energy_label,
    property_type: propertyType,
    district,
    latitude: lat,
    longitude: lng,
    target_categories: targetCategories,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(
  cityId: number,
  page: number,
): Promise<{ offers: WgOffer[]; totalPages: number }> {
  const url = `${API_BASE}?city_id=${cityId}&category=2&rent_type=0&limit=${PAGE_SIZE}&page=${page}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const resp = await fetch(url, {
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "application/json",
          "Accept-Language": "de-DE,de;q=0.9,en;q=0.5",
          Referer: `${WG_GESUCHT_BASE}/`,
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!resp.ok) {
        const retryable = resp.status === 429 || resp.status >= 500;
        if (retryable && attempt < MAX_RETRIES) {
          const backoff = RETRY_BASE_MS * Math.pow(2, attempt) + Math.random() * 500;
          log(`[WG-GESUCHT] page ${page} returned ${resp.status}, retrying in ${Math.round(backoff)}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await delay(backoff);
          continue;
        }
        throw new Error(`API returned ${resp.status}: ${resp.statusText}`);
      }

      const contentType = resp.headers.get("content-type") || "";
      if (!contentType.includes("json")) {
        const snippet = (await resp.text()).slice(0, 200);
        throw new Error(`Expected JSON but got ${contentType}: ${snippet}`);
      }

      const data: WgApiResponse = await resp.json();

      if (!data._embedded?.offers) {
        throw new Error(`Unexpected response shape — missing _embedded.offers`);
      }

      const totalPages = parseInt(data.number_of_pages, 10) || 0;
      return { offers: data._embedded.offers, totalPages };
    } catch (err: any) {
      if (err?.name === "AbortError") {
        if (attempt < MAX_RETRIES) {
          log(`[WG-GESUCHT] page ${page} timed out, retrying (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await delay(RETRY_BASE_MS * Math.pow(2, attempt));
          continue;
        }
        throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`);
      }
      if (attempt < MAX_RETRIES && !err.message?.includes("Unexpected response")) {
        const backoff = RETRY_BASE_MS * Math.pow(2, attempt) + Math.random() * 500;
        log(`[WG-GESUCHT] page ${page} error: ${err.message}, retrying in ${Math.round(backoff)}ms`);
        await delay(backoff);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Unreachable");
}

async function fetchAndParseListings(city: string): Promise<ParsedListing[]> {
  const slugs = getCitySlugs(city);
  if (!slugs?.wgGesuchtCode) {
    log(`[WG-GESUCHT] No city code for "${city}" — skipping`);
    return [];
  }

  const cityId = slugs.wgGesuchtCode;
  const allListings: ParsedListing[] = [];
  const seenIds = new Set<string>();

  for (let page = 1; page <= PAGES_TO_FETCH; page++) {
    log(`[WG-GESUCHT] ${city} page ${page}/${PAGES_TO_FETCH}`);

    let offers: WgOffer[];
    let totalPages: number;
    try {
      const result = await fetchPage(cityId, page);
      offers = result.offers;
      totalPages = result.totalPages;
    } catch (err: any) {
      log(`[WG-GESUCHT] ${city} page ${page} failed: ${err.message} — continuing with ${allListings.length} listings from prior pages`);
      break;
    }

    for (const offer of offers) {
      if (seenIds.has(offer.offer_id)) continue;
      seenIds.add(offer.offer_id);

      const listing = offerToListing(offer, city);
      if (listing) allListings.push(listing);
    }

    if (page >= totalPages) break;
    if (page < PAGES_TO_FETCH) await delay(PAGE_DELAY_MS);
  }

  log(`[WG-GESUCHT] ${city}: found ${allListings.length} listings`);
  return allListings;
}

export function createWgGesuchtIngester(city: string): Ingester {
  return {
    name: `wg-gesucht:${city}`,
    async run(): Promise<IngestionResult> {
      const parsed = await fetchAndParseListings(city);
      const result = await insertAndMatchListings(parsed);

      log(
        `[WG-GESUCHT] ${city} ingestion complete: found=${parsed.length}, inserted=${result.inserted}, duplicates=${result.duplicates}, matches=${result.matches}`,
      );

      return {
        found: parsed.length,
        ...result,
      };
    },
  };
}
