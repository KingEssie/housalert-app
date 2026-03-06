import * as cheerio from "cheerio";
import { log } from "../log";
import type { Ingester, IngestionResult } from "./types";
import type { ParsedListing } from "./matching";
import { insertAndMatchListings } from "./matching";

const SEARCH_URL = "https://www.immowelt.de/suche/berlin/wohnungen/mieten";
const USER_AGENT =
  "Stekkies/1.0 (rental alert app; polite single-page fetch; contact: stekkies@example.com)";

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

async function fetchAndParseListings(): Promise<ParsedListing[]> {
  log("Fetching Immowelt Berlin listings...");

  const response = await fetch(SEARCH_URL, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html",
      "Accept-Language": "de-DE,de;q=0.9,en;q=0.5",
    },
    redirect: "follow",
  });

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

    listings.push({
      title,
      url: fullUrl,
      city: "Berlin",
      price,
      bedrooms,
      size_m2: size,
      source: "immowelt",
      source_id: sourceId,
    });
  });

  log(`Parsed ${listings.length} listings from Immowelt`);
  return listings;
}

export const immoweltIngester: Ingester = {
  name: "immowelt",
  async run(): Promise<IngestionResult> {
    const parsed = await fetchAndParseListings();
    const result = await insertAndMatchListings(parsed);

    log(
      `Immowelt ingestion complete: found=${parsed.length}, inserted=${result.inserted}, duplicates=${result.duplicates}, matches=${result.matches}`
    );

    return {
      found: parsed.length,
      ...result,
    };
  },
};
