import * as cheerio from "cheerio";
import { createHash } from "crypto";
import { log } from "../log";
import type { Ingester, IngestionResult } from "./types";
import type { ParsedListing } from "./matching";
import { insertAndMatchListings } from "./matching";
import { getWgGesuchtUrl } from "./city-slugs";

const WG_GESUCHT_BASE = "https://www.wg-gesucht.de";
const USER_AGENT =
  "HousAlert/1.0 (rental alert app; polite single-page fetch; contact: support@housalert.de)";

function extractSourceId(href: string): string {
  const match = href.match(/\.(\d+)\.html/);
  if (match) return match[1];
  return createHash("sha256").update(href).digest("hex").slice(0, 16);
}

function parseZimmer(text: string): number {
  const match = text.match(/([\d,]+)-Zimmer/);
  if (match) {
    const num = parseFloat(match[1].replace(",", "."));
    return Math.floor(num);
  }
  return 0;
}

function parsePrice(html: string): number {
  const cleaned = html.replace(/&euro;/g, "€").replace(/&nbsp;/g, " ");
  const match = cleaned.match(/([\d.]+)\s*€/);
  if (match) return parseInt(match[1].replace(/\./g, ""), 10);
  return 0;
}

function parseSize(html: string): number {
  const cleaned = html.replace(/&sup2;/g, "²").replace(/&nbsp;/g, " ");
  const match = cleaned.match(/([\d.]+)\s*m/);
  if (match) return parseInt(match[1].replace(/\./g, ""), 10);
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

function extractFeatures(cardText: string): {
  furnished: boolean | null;
  pets_allowed: boolean | null;
  balcony: boolean | null;
  elevator: boolean | null;
} {
  return {
    furnished: parseFurnished(cardText),
    pets_allowed: NO_PETS_PATTERNS.test(cardText) ? false : PETS_PATTERNS.test(cardText) ? true : null,
    balcony: BALCONY_PATTERNS.test(cardText) ? true : null,
    elevator: ELEVATOR_PATTERNS.test(cardText) ? true : null,
  };
}

function normalizeDistrict(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function extractDistrict(title: string, city: string): string | null {
  const match = title.match(/in\s+[\w\u00C0-\u024F-]+-(.+?)(?:\.|$)/i);
  if (match) return normalizeDistrict(match[1]);
  const parts = title.split(",").map(p => p.trim());
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (last.toLowerCase() !== city.toLowerCase() && !last.match(/\d/)) {
      return normalizeDistrict(last);
    }
  }
  return null;
}

async function fetchAndParseListings(city: string): Promise<ParsedListing[]> {
  const searchUrl = getWgGesuchtUrl(city);
  if (!searchUrl) {
    log(`WG-Gesucht: no URL mapping for city "${city}" — skipping`);
    return [];
  }

  log(`Fetching WG-Gesucht ${city} listings...`);

  const response = await fetch(searchUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html",
      "Accept-Language": "de-DE,de;q=0.9,en;q=0.5",
    },
  });

  if (!response.ok) {
    throw new Error(`WG-Gesucht returned ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const listings: ParsedListing[] = [];

  $(".wgg_card.offer_list_item").each((_i, el) => {
    const card = $(el);
    const dataId = card.attr("data-id");

    if (card.hasClass("housinganywhere_ad") || card.hasClass("airbnb_ad")) {
      return;
    }

    const titleLink = card.find("h2.truncate_title a").first();
    const title = titleLink.text().trim();
    const href = titleLink.attr("href") || "";
    if (!title || !href) return;

    const fullUrl = href.startsWith("http") ? href : WG_GESUCHT_BASE + href;
    const sourceId = dataId || extractSourceId(href);

    const detailSpan = card.find(".col-xs-11 span").first().text();
    const bedrooms = parseZimmer(detailSpan);

    const middleRow = card.find(".row.middle");
    const cols = middleRow.find("[class*='col-xs']");

    let price = 0;
    let size = 0;

    if (cols.length >= 1) {
      price = parsePrice(cols.eq(0).html() || "");
    }
    if (cols.length >= 3) {
      size = parseSize(cols.eq(2).html() || "");
    }

    const imgEl = card.find("img.img-responsive").first();
    let imageUrl: string | null = imgEl.attr("src") || null;
    if (imageUrl && !imageUrl.startsWith("http")) {
      imageUrl = WG_GESUCHT_BASE + imageUrl;
    }

    const cardText = card.text();
    const features = extractFeatures(cardText);
    const district = extractDistrict(title, city);

    listings.push({
      title,
      url: fullUrl,
      city,
      price,
      bedrooms,
      size_m2: size,
      source: "wg-gesucht",
      source_id: sourceId,
      image_url: imageUrl,
      furnished: features.furnished,
      pets_allowed: features.pets_allowed,
      balcony: features.balcony,
      elevator: features.elevator,
      district,
    });
  });

  log(`Parsed ${listings.length} listings from WG-Gesucht (${city})`);
  return listings;
}

export function createWgGesuchtIngester(city: string): Ingester {
  return {
    name: `wg-gesucht:${city}`,
    async run(): Promise<IngestionResult> {
      const parsed = await fetchAndParseListings(city);
      const result = await insertAndMatchListings(parsed);

      log(
        `WG-Gesucht ${city} ingestion complete: found=${parsed.length}, inserted=${result.inserted}, duplicates=${result.duplicates}, matches=${result.matches}`
      );

      return {
        found: parsed.length,
        ...result,
      };
    },
  };
}
