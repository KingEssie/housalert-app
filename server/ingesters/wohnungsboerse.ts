import * as cheerio from "cheerio";
import { log } from "../index";
import type { Ingester, IngestionResult } from "./types";
import type { ParsedListing } from "./matching";
import { insertAndMatchListings } from "./matching";

const SEARCH_URL =
  "https://www.wohnungsboerse.net/Berlin/mieten/wohnungen";
const USER_AGENT =
  "Stekkies/1.0 (rental alert app; polite single-page fetch; contact: stekkies@example.com)";

function parsePrice(text: string): number {
  const cleaned = text.replace(/&nbsp;|&euro;|\s/g, " ").replace(/\./g, "").replace(/,/g, ".");
  const match = cleaned.match(/([\d.]+)\s*€/);
  return match ? Math.round(parseFloat(match[1])) : 0;
}

function parseSize(text: string): number {
  const cleaned = text.replace(/\./g, "").replace(/,/g, ".");
  const match = cleaned.match(/([\d.]+)\s*m/);
  return match ? Math.round(parseFloat(match[1])) : 0;
}

function parseRooms(text: string): number {
  const cleaned = text.replace(/,/g, ".").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.floor(num);
}

function extractSourceId(href: string): string {
  const match = href.match(/\/immodetail\/(\d+)/);
  return match ? match[1] : "";
}

async function fetchAndParseListings(): Promise<ParsedListing[]> {
  log("Fetching Wohnungsboerse Berlin listings...");

  const response = await fetch(SEARCH_URL, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html",
      "Accept-Language": "de-DE,de;q=0.9,en;q=0.5",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(
      `Wohnungsboerse returned ${response.status}: ${response.statusText}`
    );
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const listings: ParsedListing[] = [];
  const seen = new Set<string>();

  $("a[href*='/immodetail/']").each((_i, el) => {
    const card = $(el);
    const href = card.attr("href") || "";
    const sourceId = extractSourceId(href);
    if (!sourceId || seen.has(sourceId)) return;
    seen.add(sourceId);

    const fullUrl = href.startsWith("http")
      ? href
      : "https://www.wohnungsboerse.net" + href;

    const title =
      card.find("h3").text().trim() || card.attr("title")?.split("\n")[0]?.trim() || "Wohnungsboerse listing";

    const dlElements = card.find("dl");
    let price = 0;
    let bedrooms = 0;
    let size = 0;

    dlElements.each((_j, dl) => {
      const dtText = $(dl).find("dt").text().trim().toLowerCase();
      const ddText = $(dl).find("dd").text().trim();

      if (dtText.includes("kaltmiete") || dtText.includes("miete")) {
        price = parsePrice(ddText);
      } else if (dtText.includes("zimmer") || dtText.includes("zi")) {
        bedrooms = parseRooms(ddText);
      } else if (dtText.includes("fläche") || dtText.includes("flache") || dtText.includes("fl")) {
        size = parseSize(ddText);
      }
    });

    if (price === 0 && bedrooms === 0 && size === 0) {
      const statsDiv = card.find(".divide-x, .divide-bg-muted");
      const dds = statsDiv.find("dd");
      if (dds.length >= 1) price = parsePrice(dds.eq(0).text());
      if (dds.length >= 2) bedrooms = parseRooms(dds.eq(1).text());
      if (dds.length >= 3) size = parseSize(dds.eq(2).text());
    }

    listings.push({
      title,
      url: fullUrl,
      city: "Berlin",
      price,
      bedrooms,
      size_m2: size,
      source: "wohnungsboerse",
      source_id: sourceId,
    });
  });

  log(`Parsed ${listings.length} listings from Wohnungsboerse`);
  return listings;
}

export const wohnungsboerseIngester: Ingester = {
  name: "wohnungsboerse",
  async run(): Promise<IngestionResult> {
    const parsed = await fetchAndParseListings();
    const result = await insertAndMatchListings(parsed);

    log(
      `Wohnungsboerse ingestion complete: found=${parsed.length}, inserted=${result.inserted}, duplicates=${result.duplicates}, matches=${result.matches}`
    );

    return {
      found: parsed.length,
      ...result,
    };
  },
};
