import * as cheerio from "cheerio";
import { createHash } from "crypto";
import { log } from "../log";
import type { Ingester, IngestionResult } from "./types";
import type { ParsedListing } from "./matching";
import { insertAndMatchListings } from "./matching";

const KLEINANZEIGEN_BASE = "https://www.kleinanzeigen.de";
const BERLIN_SEARCH_URL =
  KLEINANZEIGEN_BASE + "/s-wohnung-mieten/berlin/c203l3331";
const USER_AGENT =
  "Stekkies/1.0 (rental alert app; polite single-page fetch; contact: stekkies@example.com)";

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

async function fetchAndParseListings(): Promise<ParsedListing[]> {
  log("Fetching Kleinanzeigen Berlin listings...");

  const response = await fetch(BERLIN_SEARCH_URL, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html",
      "Accept-Language": "de-DE,de;q=0.9,en;q=0.5",
    },
  });

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

    listings.push({
      title,
      url: fullUrl,
      city: "Berlin",
      price,
      bedrooms,
      size_m2: size,
      source: "kleinanzeigen",
      source_id: sourceId,
    });
  });

  log(`Parsed ${listings.length} listings from Kleinanzeigen`);
  return listings;
}

export const kleinanzeigenIngester: Ingester = {
  name: "kleinanzeigen",
  async run(): Promise<IngestionResult> {
    const parsed = await fetchAndParseListings();
    const result = await insertAndMatchListings(parsed);

    log(
      `Kleinanzeigen ingestion complete: found=${parsed.length}, inserted=${result.inserted}, duplicates=${result.duplicates}, matches=${result.matches}`
    );

    return {
      found: parsed.length,
      ...result,
    };
  },
};
