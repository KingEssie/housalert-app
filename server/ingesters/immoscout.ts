import * as cheerio from "cheerio";
import { log } from "../index";
import type { Ingester, IngestionResult } from "./types";
import type { ParsedListing } from "./matching";
import { insertAndMatchListings } from "./matching";

const SEARCH_URL =
  "https://www.immobilienscout24.de/Suche/de/berlin/wohnung-mieten";
const USER_AGENT =
  "Stekkies/1.0 (rental alert app; polite single-page fetch; contact: stekkies@example.com)";

function parsePrice(text: string): number {
  const cleaned = text.replace(/\./g, "").replace(/,/g, ".");
  const match = cleaned.match(/([\d.]+)\s*€/);
  return match ? Math.round(parseFloat(match[1])) : 0;
}

function parseSize(text: string): number {
  const cleaned = text.replace(/\./g, "").replace(/,/g, ".");
  const match = cleaned.match(/([\d.]+)\s*m/);
  return match ? Math.round(parseFloat(match[1])) : 0;
}

function parseRooms(text: string): number {
  const match = text.replace(/,/g, ".").match(/([\d.]+)\s*Zi/);
  return match ? Math.floor(parseFloat(match[1])) : 0;
}

function extractExposeId(href: string): string {
  const match = href.match(/\/expose\/(\d+)/);
  return match ? match[1] : "";
}

async function fetchAndParseListings(): Promise<ParsedListing[]> {
  log("Fetching ImmoScout24 Berlin listings...");

  const response = await fetch(SEARCH_URL, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "de-DE,de;q=0.9,en;q=0.5",
    },
    redirect: "follow",
  });

  if (response.status === 401 || response.status === 403 || response.status === 429) {
    log(`ImmoScout24 blocked request (HTTP ${response.status}) — bot protection active, skipping`);
    return [];
  }

  if (!response.ok) {
    throw new Error(
      `ImmoScout24 returned ${response.status}: ${response.statusText}`
    );
  }

  const html = await response.text();

  if (
    html.includes("Ich bin kein Roboter") ||
    html.includes("Gleich geht") ||
    html.includes("challenge.js")
  ) {
    log("ImmoScout24 returned a captcha/bot-check page — no listings scraped");
    return [];
  }

  const $ = cheerio.load(html);
  const listings: ParsedListing[] = [];
  const seen = new Set<string>();

  $("article.result-list-entry, li.result-list-entry, article[data-item]").each(
    (_i, el) => {
      const card = $(el);

      let link = card.find("a[href*='/expose/']").first();
      if (!link.length) {
        link = card.find("a.result-list-entry__brand-title-container").first();
      }
      const href = link.attr("href") || "";
      const exposeId = extractExposeId(href);
      if (!exposeId || seen.has(exposeId)) return;
      seen.add(exposeId);

      const fullUrl = href.startsWith("http")
        ? href
        : "https://www.immobilienscout24.de" + href;

      const title =
        card.find("h2.result-list-entry__brand-title, .result-list-entry__brand-title").text().trim() ||
        card.find('[data-is24-qa="expose_listing_title"]').text().trim() ||
        link.attr("title") ||
        "ImmoScout listing";

      const priceText =
        card.find('[data-is24-qa="listing_price"], .result-list-entry__criteria .grid-item:first-child dd').text().trim();
      const price = parsePrice(priceText);

      const sizeText =
        card.find('[data-is24-qa="listing_area"], .result-list-entry__criteria .grid-item:nth-child(2) dd').text().trim();
      const size = parseSize(sizeText);

      const roomsText =
        card.find('[data-is24-qa="listing_rooms"], .result-list-entry__criteria .grid-item:nth-child(3) dd').text().trim();
      const bedrooms = parseRooms(roomsText);

      listings.push({
        title,
        url: fullUrl,
        city: "Berlin",
        price,
        bedrooms,
        size_m2: size,
        source: "immoscout",
        source_id: exposeId,
      });
    }
  );

  log(`Parsed ${listings.length} listings from ImmoScout24`);
  return listings;
}

export const immoscoutIngester: Ingester = {
  name: "immoscout",
  async run(): Promise<IngestionResult> {
    const parsed = await fetchAndParseListings();
    const result = await insertAndMatchListings(parsed);

    log(
      `ImmoScout24 ingestion complete: found=${parsed.length}, inserted=${result.inserted}, duplicates=${result.duplicates}, matches=${result.matches}`
    );

    return {
      found: parsed.length,
      ...result,
    };
  },
};
