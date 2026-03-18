import * as cheerio from "cheerio";
import { createHash } from "crypto";
import { log } from "../log";
import type { Ingester, IngestionResult } from "./types";
import type { ParsedListing } from "./matching";
import { insertAndMatchListings } from "./matching";
import type { SourceConfig } from "./config/sources";

const USER_AGENT =
  "HousAlert/1.0 (rental alert app; polite single-page fetch; contact: support@housalert.com)";

function extractField(
  $card: cheerio.Cheerio<cheerio.Element>,
  $: cheerio.CheerioAPI,
  field: { selector: string; attr?: string; regex?: string } | null
): string {
  if (!field) return "";
  const selectors = field.selector.split(",").map((s) => s.trim());
  let text = "";
  for (const sel of selectors) {
    const el = $card.is(sel) ? $card : $card.find(sel);
    if (el.length) {
      text = field.attr ? (el.attr(field.attr) || "") : el.first().text();
      if (text.trim()) break;
    }
  }
  return text.trim();
}

function parseNumber(text: string, regex?: string): number {
  const cleaned = text.replace(/&nbsp;|&euro;|\s+/g, " ").trim();
  if (regex) {
    const match = cleaned.replace(/\./g, "").replace(/,/g, ".").match(new RegExp(regex));
    if (match) return Math.round(parseFloat(match[1]));
    return 0;
  }
  const numMatch = cleaned.replace(/\./g, "").replace(/,/g, ".").match(/([\d.]+)/);
  return numMatch ? Math.round(parseFloat(numMatch[1])) : 0;
}

function extractSourceId(url: string, regex?: string): string {
  if (regex) {
    const match = url.match(new RegExp(regex));
    if (match) return match[1];
  }
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

function isBlocked(html: string, patterns?: string[]): boolean {
  if (!patterns || patterns.length === 0) return false;
  return patterns.some((p) => html.includes(p));
}

async function fetchAndParse(
  config: SourceConfig
): Promise<ParsedListing[]> {
  log(`Fetching ${config.name} listings...`);

  if (config.rateLimitMs && config.rateLimitMs > 0) {
    await new Promise((r) => setTimeout(r, config.rateLimitMs));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await fetch(config.searchUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.5",
      },
      redirect: "follow",
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      log(`${config.name} fetch timed out after 30s — skipping`);
      return [];
    }
    throw err;
  }
  clearTimeout(timeout);

  if (response.status === 401 || response.status === 403 || response.status === 410 || response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504) {
    log(`${config.name} returned HTTP ${response.status} — skipping`);
    return [];
  }

  if (!response.ok) {
    throw new Error(`${config.name} returned ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();

  if (isBlocked(html, config.botBlockPatterns)) {
    log(`${config.name} returned bot-check page — skipping`);
    return [];
  }

  const $ = cheerio.load(html);
  const listings: ParsedListing[] = [];
  const seen = new Set<string>();

  $(config.cardSelector).each((_i, el) => {
    const $card = $(el);

    let rawUrl = "";
    if (config.fields.url) {
      const urlField = config.fields.url;
      const selectors = urlField.selector.split(",").map((s) => s.trim());
      for (const sel of selectors) {
        const urlEl = $card.is(sel) ? $card : $card.find(sel);
        if (urlEl.length) {
          rawUrl = urlEl.attr(urlField.attr) || "";
          if (rawUrl) break;
        }
      }
    }

    if (!rawUrl) return;

    const fullUrl = rawUrl.startsWith("http")
      ? rawUrl
      : config.baseUrl + (rawUrl.startsWith("/") ? "" : "/") + rawUrl;

    const sourceId = extractSourceId(fullUrl, config.sourceIdRegex);
    if (!sourceId || seen.has(sourceId)) return;
    seen.add(sourceId);

    const title =
      extractField($card, $, config.fields.title) ||
      $card.attr("title")?.split("\n")[0]?.trim() ||
      `${config.name} listing`;

    const priceText = extractField($card, $, config.fields.price);
    const price = parseNumber(priceText, config.fields.price?.regex);

    const sizeText = extractField($card, $, config.fields.size_m2);
    const size = parseNumber(sizeText, config.fields.size_m2?.regex);

    let bedrooms = 0;
    if (config.fields.bedrooms) {
      const roomsText = extractField($card, $, config.fields.bedrooms);
      bedrooms = parseNumber(roomsText, config.fields.bedrooms.regex);
    }

    let imageUrl: string | null = null;
    if (config.fields.image) {
      const imgField = config.fields.image;
      const imgEl = $card.find(imgField.selector).first();
      if (imgEl.length) {
        const raw = imgEl.attr(imgField.attr) || "";
        if (raw && raw.startsWith("http")) {
          imageUrl = raw;
        } else if (raw && !raw.includes("blank")) {
          imageUrl = config.baseUrl + (raw.startsWith("/") ? "" : "/") + raw;
        }
      }
    }

    listings.push({
      title,
      url: fullUrl,
      city: config.city,
      price,
      bedrooms,
      size_m2: size,
      source: config.source,
      source_id: sourceId,
      image_url: imageUrl,
    });
  });

  log(`Parsed ${listings.length} listings from ${config.name}`);
  return listings;
}

export function createConfigIngester(config: SourceConfig): Ingester {
  return {
    name: config.name,
    async run(): Promise<IngestionResult> {
      const parsed = await fetchAndParse(config);
      const result = await insertAndMatchListings(parsed);

      log(
        `${config.name} ingestion complete: found=${parsed.length}, inserted=${result.inserted}, duplicates=${result.duplicates}, matches=${result.matches}`
      );

      return {
        found: parsed.length,
        ...result,
      };
    },
  };
}
