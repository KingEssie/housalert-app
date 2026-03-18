import * as cheerio from "cheerio";
import { log } from "../log";
import type { Ingester, IngestionResult } from "./types";
import type { ParsedListing } from "./matching";
import { insertAndMatchListings } from "./matching";
import { getImmoweltUrl } from "./city-slugs";

const USER_AGENT =
  "HousAlert/1.0 (rental alert app; polite single-page fetch; contact: support@housalert.com)";

function parsePrice(ariaLabel: string): number {
  const match = ariaLabel.replace(/\./g, "").match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function parseZimmer(text: string): number {
  const match = text.match(/([\d,]+)\s*Zimmer/);
  if (match) return Math.floor(parseFloat(match[1].replace(",", ".")));
  return 0;
}

function parseSize(text: string): number {
  const match = text.replace(/\./g, "").match(/([\d,]+)\s*m/);
  if (match) return Math.round(parseFloat(match[1].replace(",", ".")));
  return 0;
}

function extractSourceId(exposeUrl: string): string {
  const match = exposeUrl.match(/\/expose\/([a-f0-9-]+)/i);
  return match ? match[1] : "";
}

const UNFURNISHED_PATTERNS = /unmöbliert|unfurnished|nicht\s*möbliert/i;
const FURNISHED_PATTERNS = /möbliert|furnished|teilmöbliert|voll\s*möbliert/i;
const NO_PETS_PATTERNS = /keine\s*haustiere|keine\s*tiere|no\s*pets|haustiere\s*nicht\s*erlaubt|tiere\s*nicht\s*erlaubt/i;
const PETS_PATTERNS = /haustier|pet|tiere?\s*erlaubt/i;
const BALCONY_PATTERNS = /balkon|balcony|terrasse|loggia/i;
const ELEVATOR_PATTERNS = /aufzug|fahrstuhl|elevator|lift/i;

function parseFurnished(text: string): boolean | null {
  if (UNFURNISHED_PATTERNS.test(text)) return false;
  if (FURNISHED_PATTERNS.test(text)) return true;
  return null;
}

function extractFeatures(text: string): {
  furnished: boolean | null;
  pets_allowed: boolean | null;
  balcony: boolean | null;
  elevator: boolean | null;
} {
  return {
    furnished: parseFurnished(text),
    pets_allowed: NO_PETS_PATTERNS.test(text) ? false : PETS_PATTERNS.test(text) ? true : null,
    balcony: BALCONY_PATTERNS.test(text) ? true : null,
    elevator: ELEVATOR_PATTERNS.test(text) ? true : null,
  };
}

function normalizeDistrict(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function extractDistrict(address: string, city: string): string | null {
  const parts = address.split(",").map(p => p.trim());
  if (parts.length >= 2) {
    for (const part of parts) {
      if (part.toLowerCase() !== city.toLowerCase() && !part.match(/^\d/) && part.length > 1) {
        return normalizeDistrict(part);
      }
    }
  }
  const match = address.match(/(\S+),\s*\d/);
  if (match && match[1].toLowerCase() !== city.toLowerCase()) {
    return normalizeDistrict(match[1]);
  }
  return null;
}

async function fetchAndParseListings(city: string): Promise<ParsedListing[]> {
  const searchUrl = getImmoweltUrl(city);
  log(`Fetching Immowelt ${city} listings...`);

  const controller = new AbortController();
  const fetchTimer = setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await fetch(searchUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.5",
      },
      redirect: "follow",
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(fetchTimer);
    if (err.name === "AbortError") {
      log(`Immowelt ${city} fetch timed out after 30s — skipping`);
      return [];
    }
    throw err;
  }
  clearTimeout(fetchTimer);

  if (response.status === 401 || response.status === 403 || response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504) {
    log(`Immowelt ${city} returned HTTP ${response.status} — skipping`);
    return [];
  }

  if (!response.ok) {
    throw new Error(`Immowelt returned ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const listings: ParsedListing[] = [];
  const seen = new Set<string>();

  $('[data-testid="serp-core-classified-card-testid"]').each((_i, el) => {
    const card = $(el);

    const link = card.find('[data-testid="card-mfe-covering-link-testid"]');
    const href = link.attr("href") || "";
    if (!href.includes("/expose/")) return;

    const sourceId = extractSourceId(href);
    if (!sourceId || seen.has(sourceId)) return;
    seen.add(sourceId);

    const fullUrl = href.startsWith("http")
      ? href
      : "https://www.immowelt.de" + href;

    const linkTitle = link.attr("title") || "";
    const addressEl = card.find('[data-testid="cardmfe-description-box-address"]');
    const address = addressEl.text().trim();
    const title = address || linkTitle || "Immowelt listing";

    const priceEl = card.find('[data-testid="cardmfe-price-testid"]');
    const priceLabel = priceEl.attr("aria-label") || priceEl.text();
    const price = parsePrice(priceLabel);

    const keyFacts = card.find('[data-testid="cardmfe-keyfacts-testid"]').text();
    const bedrooms = parseZimmer(keyFacts);
    const size = parseSize(keyFacts);

    const imgEl = card.find("img[src*='immowelt'], img[src*='cdn.'], picture source[srcset]").first();
    let imageUrl: string | null = null;
    if (imgEl.length) {
      let raw = imgEl.attr("src") || imgEl.attr("srcset")?.split(",")[0]?.trim()?.split(" ")[0] || "";
      if (raw && raw.startsWith("http")) {
        try {
          const imgUrl = new URL(raw);
          if (imgUrl.hostname.includes("immowelt") && imgUrl.searchParams.has("h")) {
            imgUrl.searchParams.set("h", "400");
            raw = imgUrl.toString();
          }
        } catch {}
        imageUrl = raw;
      }
    }

    const cardText = card.text();
    const features = extractFeatures(cardText);
    const district = extractDistrict(address, city);

    listings.push({
      title,
      url: fullUrl,
      city,
      price,
      bedrooms,
      size_m2: size,
      source: "immowelt",
      source_id: sourceId,
      image_url: imageUrl,
      furnished: features.furnished,
      pets_allowed: features.pets_allowed,
      balcony: features.balcony,
      elevator: features.elevator,
      district,
    });
  });

  log(`Parsed ${listings.length} listings from Immowelt (${city})`);
  return listings;
}

export function createImmoweltIngester(city: string): Ingester {
  return {
    name: `immowelt:${city}`,
    async run(): Promise<IngestionResult> {
      const parsed = await fetchAndParseListings(city);
      const result = await insertAndMatchListings(parsed);

      log(
        `Immowelt ${city} ingestion complete: found=${parsed.length}, inserted=${result.inserted}, duplicates=${result.duplicates}, matches=${result.matches}`
      );

      return {
        found: parsed.length,
        ...result,
      };
    },
  };
}
