import * as cheerio from "cheerio";
import { createHash } from "crypto";
import { log } from "../log";
import type { Ingester, IngestionResult } from "./types";
import type { ParsedListing } from "./matching";
import { insertAndMatchListings } from "./matching";
import { getKleinanzeigenUrl } from "./city-slugs";

const KLEINANZEIGEN_BASE = "https://www.kleinanzeigen.de";
const USER_AGENT =
  "HousAlert/1.0 (rental alert app; polite single-page fetch; contact: support@housalert.de)";

function extractSourceId(href: string): string {
  const match = href.match(/\/(\d+)-/);
  if (match) return match[1];
  return createHash("sha256").update(href).digest("hex").slice(0, 16);
}

function parsePrice(text: string): number {
  const cleaned = text.replace(/\./g, "").replace(",", ".");
  const match = cleaned.match(/([\d]+)\s*€/);
  if (match) return parseInt(match[1], 10);
  return 0;
}

function parseSize(text: string): number {
  const match = text.match(/([\d.,]+)\s*m²/);
  if (match) return Math.round(parseFloat(match[1].replace(",", ".")));
  return 0;
}

function parseRooms(text: string): number {
  const match = text.match(/([\d,]+)\s*(?:Zimmer|Zi\.?)/);
  if (match) {
    const num = parseFloat(match[1].replace(",", "."));
    return Math.floor(num);
  }
  return 0;
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

function extractDistrict(locationText: string, title: string, city: string): string | null {
  if (locationText) {
    const locParts = locationText.split(/\n/).map(p => p.trim()).filter(Boolean);
    for (const part of locParts) {
      const cleaned = part.replace(/\s*\(\w+\)\s*$/, "").trim();
      if (
        cleaned &&
        cleaned.toLowerCase() !== city.toLowerCase() &&
        !cleaned.match(/^\d/) &&
        cleaned.length > 1
      ) {
        if (cleaned.includes(" - ")) {
          const sub = cleaned.split(" - ");
          const candidate = sub[sub.length - 1].trim();
          if (candidate && candidate.toLowerCase() !== city.toLowerCase()) {
            return normalizeDistrict(candidate);
          }
        }
        if (!cleaned.toLowerCase().startsWith(city.toLowerCase())) {
          return normalizeDistrict(cleaned);
        }
        const afterCity = cleaned.slice(city.length).replace(/^[\s\-–]+/, "").trim();
        if (afterCity) {
          return normalizeDistrict(afterCity);
        }
      }
    }
  }

  const titleMatch = title.match(/,\s*([^,\d]+)$/);
  if (titleMatch) {
    const candidate = titleMatch[1].trim();
    if (candidate.toLowerCase() !== city.toLowerCase() && candidate.length > 1) {
      return normalizeDistrict(candidate);
    }
  }

  return null;
}

async function fetchAndParseListings(city: string): Promise<ParsedListing[]> {
  const searchUrl = getKleinanzeigenUrl(city);
  if (!searchUrl) {
    log(`Kleinanzeigen: no URL mapping for city "${city}" — skipping`);
    return [];
  }

  log(`Fetching Kleinanzeigen ${city} listings...`);

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
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(fetchTimer);
    if (err.name === "AbortError") {
      log(`Kleinanzeigen ${city} fetch timed out after 30s — skipping`);
      return [];
    }
    throw err;
  }
  clearTimeout(fetchTimer);

  if (response.status === 403 || response.status === 401 || response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504) {
    log(`Kleinanzeigen ${city} returned HTTP ${response.status} — skipping`);
    return [];
  }

  if (!response.ok) {
    throw new Error(`Kleinanzeigen returned ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const listings: ParsedListing[] = [];

  $("article.aditem").each((_i, el) => {
    const card = $(el);
    const dataId = card.attr("data-adid");
    const dataHref = card.attr("data-href") || "";

    let titleLink = card.find("h2 a.ellipsis").first();
    if (!titleLink.length) titleLink = card.find("a.ellipsis").first();
    const title = titleLink.text().trim();
    const href = titleLink.attr("href") || dataHref;
    if (!title || !href) return;

    const fullUrl = href.startsWith("http") ? href : KLEINANZEIGEN_BASE + href;
    const sourceId = dataId || extractSourceId(href);

    const tagsText = card.find(".aditem-main--middle--tags").text();
    const size = parseSize(tagsText);
    const bedrooms = parseRooms(tagsText);

    const priceText = card
      .find(".aditem-main--middle--price-shipping--price")
      .text();
    const price = parsePrice(priceText);

    const imgEl = card.find("img[src*='kleinanzeigen.de']").first();
    let imageUrl: string | null = imgEl.attr("src") || null;
    if (imageUrl) {
      imageUrl = imageUrl.replace(/\?rule=\$_\d+\.AUTO/, "?rule=$_35.AUTO");
    }

    const cardText = card.text() + " " + title;
    const features = extractFeatures(cardText);

    const locationText = card.find(".aditem-main--top--left").text().trim();
    const district = extractDistrict(locationText, title, city);

    listings.push({
      title,
      url: fullUrl,
      city,
      price,
      bedrooms,
      size_m2: size,
      source: "kleinanzeigen",
      source_id: sourceId,
      image_url: imageUrl,
      furnished: features.furnished,
      pets_allowed: features.pets_allowed,
      balcony: features.balcony,
      elevator: features.elevator,
      district,
    });
  });

  log(`Parsed ${listings.length} listings from Kleinanzeigen (${city})`);
  return listings;
}

export function createKleinanzeigenIngester(city: string): Ingester {
  return {
    name: `kleinanzeigen:${city}`,
    async run(): Promise<IngestionResult> {
      const parsed = await fetchAndParseListings(city);
      const result = await insertAndMatchListings(parsed);

      log(
        `Kleinanzeigen ${city} ingestion complete: found=${parsed.length}, inserted=${result.inserted}, duplicates=${result.duplicates}, matches=${result.matches}`
      );

      return {
        found: parsed.length,
        ...result,
      };
    },
  };
}
