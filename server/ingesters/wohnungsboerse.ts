import * as cheerio from "cheerio";
import { log } from "../log";
import type { Ingester, IngestionResult } from "./types";
import type { ParsedListing } from "./matching";
import { insertAndMatchListings } from "./matching";
import { getWohnungsboerseUrl } from "./city-slugs";
import {
  extractGarden, extractBath, extractRoofTerrace, extractParking,
  extractEnergyLabel, extractPropertyTypeFromText,
} from "./feature-extraction";
import { extractPostcodeFromText } from "./geocoding";

const WB_BASE = "https://www.wohnungsboerse.net";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const PAGES_TO_FETCH   = 3;
const PAGE_DELAY_MS    = 1800;
const FETCH_TIMEOUT_MS = 30_000;
const ROOT_TIMEOUT_MS  = 12_000;
const MAX_RETRIES      = 2;
const RETRY_BASE_MS    = 3_000;

const PHASE1_ENABLED_CITIES = new Set(["Berlin"]);

const BOT_MARKERS = [
  "captcha-delivery.com",
  "datadome",
  "DataDome",
  "cf-browser-verification",
  "AwsWafIntegration",
  "challenge-platform",
  "Just a moment",
  "Enable JavaScript and cookies",
  "Checking your browser",
  "imperva",
  "__cf_chl_f_tk",
  "bitte aktivieren Sie JavaScript",
];

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function buildBrowserHeaders(referer?: string): Record<string, string> {
  return {
    "User-Agent": BROWSER_UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
    "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": referer ? "same-origin" : "none",
    "sec-fetch-user": "?1",
    "upgrade-insecure-requests": "1",
    "cache-control": "max-age=0",
    ...(referer ? { referer } : {}),
  };
}

function parseCookies(headers: Headers): string {
  const parts: string[] = [];
  try {
    const setCookie = headers.getSetCookie?.() ?? [];
    for (const c of setCookie) parts.push(c.split(";")[0].trim());
  } catch {
    const raw = headers.get("set-cookie") ?? "";
    for (const c of raw.split(",")) {
      const p = c.split(";")[0].trim();
      if (p.includes("=")) parts.push(p);
    }
  }
  return parts.join("; ");
}

function isBotBlocked(html: string, status: number): { blocked: boolean; reason: string } {
  if (status === 401) return { blocked: true, reason: "HTTP 401 Unauthorized" };
  if (status === 403) return { blocked: true, reason: "HTTP 403 Forbidden" };
  if (status === 429) return { blocked: true, reason: "HTTP 429 Rate Limited" };

  for (const marker of BOT_MARKERS) {
    if (html.includes(marker)) {
      return { blocked: true, reason: `Bot marker: "${marker.slice(0, 40)}"` };
    }
  }

  if (status === 200 && html.length < 5_000) {
    return { blocked: true, reason: `Suspiciously short 200 response (${html.length} bytes)` };
  }

  return { blocked: false, reason: "" };
}

function buildPageUrl(baseUrl: string, page: number): string {
  if (page <= 1) return baseUrl;
  const sep = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${sep}page=${page}`;
}

async function fetchWithTimeout(url: string, headers: Record<string, string>, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { headers, signal: ctrl.signal });
  } catch (err: any) {
    if (err.name === "AbortError") throw new Error(`[WB] Fetch timed out after ${ms / 1000}s: ${url}`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(url: string, headers: Record<string, string>, ms = FETCH_TIMEOUT_MS): Promise<Response | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await delay(RETRY_BASE_MS * Math.pow(2, attempt - 1));
      log(`[WB] Retry ${attempt}/${MAX_RETRIES}: ${url}`);
    }
    try {
      return await fetchWithTimeout(url, headers, ms);
    } catch (err: any) {
      if (attempt === MAX_RETRIES) {
        log(`[WB] All retries exhausted: ${err.message}`);
        return null;
      }
    }
  }
  return null;
}

async function acquireSession(): Promise<string> {
  try {
    const resp = await fetchWithTimeout(WB_BASE, buildBrowserHeaders(), ROOT_TIMEOUT_MS);
    const cookies = parseCookies(resp.headers);
    if (cookies) log("[WB] Session established with cookies");
    return cookies;
  } catch (err: any) {
    log(`[WB] Root fetch failed (no session): ${err.message}`);
    return "";
  }
}

function parsePrice(raw: string): { price: number; rentType: "kalt" | "warm" | "unknown" } {
  const type = /warmmiete|warm\b/i.test(raw) ? "warm"
    : /kaltmiete|kalt\b/i.test(raw) ? "kalt"
    : "unknown";
  const clean = raw.replace(/\./g, "").replace(",", ".");
  const m = clean.match(/([\d]+(?:\.\d+)?)/);
  const price = m ? Math.round(parseFloat(m[1])) : 0;
  return { price, rentType: type };
}

function parseRooms(text: string): number {
  const m = text.match(/([\d,]+)\s*(?:Zimmer|Zi\.?)/i);
  if (m) return parseFloat(m[1].replace(",", "."));
  const simple = text.trim().match(/^([\d,]+)$/);
  if (simple) return parseFloat(simple[1].replace(",", "."));
  return 0;
}

function parseSize(text: string): number {
  const m = text.match(/([\d.,]+)\s*m[²2]/);
  if (m) return Math.round(parseFloat(m[1].replace(/\./g, "").replace(",", ".")));
  return 0;
}

function parseWarmRentFromDesc(text: string): number | null {
  const patterns = [
    /warmmiete\s*:?\s*([\d.,]+)\s*€/i,
    /warm(?:miete)?\s*:?\s*([\d.,]+)\s*€/i,
    /inkl\.?\s*nk\s*:?\s*([\d.,]+)\s*€/i,
    /gesamtmiete[^€]{0,25}([\d.,]+)\s*€/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return Math.round(parseFloat(m[1].replace(/\./g, "").replace(",", ".")));
  }
  return null;
}

function decodeHtmlEntities(html: string): string {
  return html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;lt;/g, "<")
    .replace(/&amp;gt;/g, ">")
    .replace(/&amp;amp;/g, "&")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t || t.startsWith("data:")) return null;
  if (/placeholder|noimage|no-image|blank|spacer|1x1|\.svg/i.test(t)) return null;
  if (t.startsWith("//")) return "https:" + t;
  if (t.startsWith("http")) return t;
  return null;
}

const UNFURNISHED_RE = /unmöbliert|unfurnished|nicht\s*möbliert/i;
const FURNISHED_RE   = /möbliert|furnished|teilmöbliert|voll\s*möbliert/i;
const NO_PETS_RE     = /keine\s*haustiere|keine\s*tiere|no\s*pets/i;
const PETS_RE        = /haustier|tiere?\s*erlaubt|pet[- ]?friendly/i;
const NO_BALCONY_RE  = /kein(?:en?)?\s*balkon|ohne\s*balkon/i;
const BALCONY_RE     = /\bbalkon\b|balcony|loggia|terrasse/i;
const TERRACE_RE     = /loggia|terrasse/i;
const NO_ELEVATOR_RE = /kein(?:en?)?\s*(?:aufzug|fahrstuhl|lift)|ohne\s*(?:aufzug|fahrstuhl|lift)/i;
const ELEVATOR_RE    = /aufzug|fahrstuhl|elevator|\blift\b/i;

function extractFeatures(text: string) {
  const hasNoBalcony = NO_BALCONY_RE.test(text);
  const hasBalcony   = BALCONY_RE.test(text);
  const balcony = !hasBalcony ? null : (hasNoBalcony && !TERRACE_RE.test(text)) ? false : true;
  const elevator = !ELEVATOR_RE.test(text) ? null : NO_ELEVATOR_RE.test(text) ? false : true;
  return {
    furnished:     UNFURNISHED_RE.test(text) ? false : FURNISHED_RE.test(text) ? true : null,
    pets_allowed:  NO_PETS_RE.test(text) ? false : PETS_RE.test(text) ? true : null,
    balcony,
    elevator,
    garden:        extractGarden(text),
    bath:          extractBath(text),
    roof_terrace:  extractRoofTerrace(text),
    parking:       extractParking(text),
    energy_label:  extractEnergyLabel(text),
    property_type: extractPropertyTypeFromText(text),
  };
}

function extractDistrict(locationText: string, city: string): string | null {
  const cityLower = city.toLowerCase();
  for (const sep of [" - ", " – ", " | ", ","]) {
    const parts = locationText.split(sep).map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      for (const part of parts) {
        if (!part || part.toLowerCase() === cityLower || /^\d/.test(part)) continue;
        if (part.toLowerCase().startsWith(cityLower)) {
          const after = part.slice(city.length).replace(/^[\s\-–,]+/, "").trim();
          if (after && after.length > 2) return after;
          continue;
        }
        if (part.length > 2 && part.length < 60) return part;
      }
    }
  }
  return null;
}

function parseListingCard(
  $: cheerio.CheerioAPI,
  card: cheerio.Element,
  city: string,
): ParsedListing | null {
  const $card = $(card);

  const href = $card.attr("href") ?? "";
  if (!href.includes("/immodetail/")) return null;

  const m = href.match(/\/immodetail\/(\d+)/);
  if (!m) return null;
  const sourceId = m[1];
  const fullUrl = href.startsWith("http") ? href : WB_BASE + href;

  const title = $card.find("h3").first().text().trim();
  if (!title) return null;

  const rawDesc = $card.attr("title") ?? "";
  const descText = decodeHtmlEntities(rawDesc);

  const locationEl = $card.find("div").filter((_i, el) => {
    return $(el).attr("class")?.includes("icon-location_marker") ?? false;
  }).first();
  const locationText = locationEl.text().trim()
    || $card.find(".before\\:icon-location_marker").first().text().trim();
  const district = extractDistrict(locationText, city);

  const dlItems: Array<{ label: string; value: string }> = [];
  $card.find("dl").each((_i, dlEl) => {
    const label = $(dlEl).find("dt").text().trim();
    const dd = $(dlEl).find("dd").first().clone();
    dd.find("span").remove();
    const value = dd.text().trim() || $(dlEl).find("dd").first().text().replace(/\s+/g, " ").trim();
    if (label && value) dlItems.push({ label, value });
  });

  let price = 0;
  let rentType: "kalt" | "warm" | "unknown" = "unknown";
  let rooms = 0;
  let size_m2 = 0;
  let nebenkostenValue = 0;

  for (const item of dlItems) {
    const labelLower = item.label.toLowerCase();
    if (labelLower.includes("kaltmiete")) {
      const parsed = parsePrice(item.value + " " + item.label);
      if (parsed.price > 0) { price = parsed.price; rentType = "kalt"; }
    } else if (labelLower.includes("warmmiete") || labelLower.includes("gesamtmiete")) {
      const parsed = parsePrice(item.value);
      if (parsed.price > 0) { price = parsed.price; rentType = "warm"; }
    } else if (labelLower.includes("nebenkosten")) {
      const parsed = parsePrice(item.value);
      if (parsed.price > 0) nebenkostenValue = parsed.price;
    } else if (labelLower.includes("zimmer")) {
      if (rooms === 0) rooms = parseRooms(item.value);
    } else if (labelLower.includes("fl") || labelLower.includes("fläche") || labelLower.includes("wohnfläche")) {
      if (size_m2 === 0) size_m2 = parseSize(item.value);
    }
  }

  if (rooms === 0) rooms = parseRooms(title);

  const warmRentFromDesc = parseWarmRentFromDesc(descText);
  let effectivePrice = price;
  if (rentType === "kalt" && nebenkostenValue > 0) {
    effectivePrice = price + nebenkostenValue;
    rentType = "warm";
  } else if (warmRentFromDesc && warmRentFromDesc > price) {
    effectivePrice = warmRentFromDesc;
    rentType = "warm";
  }

  const postcode = extractPostcodeFromText(locationText)
    || extractPostcodeFromText(descText)
    || null;

  const allText = [title, descText, locationText].join(" ");
  const features = extractFeatures(allText);

  let imageUrl: string | null = null;
  const img = $card.find("img[src*='/assets/estates/']").first();
  imageUrl = normalizeImageUrl(img.attr("src") || img.attr("data-src") || img.attr("data-lazy"));
  if (!imageUrl) {
    $card.find("img").each((_i, imgEl) => {
      if (imageUrl) return;
      imageUrl = normalizeImageUrl($(imgEl).attr("src") || $(imgEl).attr("data-src"));
    });
  }

  const extraFeatures: string[] = [`renttype:${rentType}`];
  if (effectivePrice > price && price > 0) extraFeatures.push(`warmmiete:${effectivePrice}`);
  if (nebenkostenValue > 0) extraFeatures.push(`nebenkosten:${nebenkostenValue}`);
  if (features.property_type) extraFeatures.push(features.property_type);

  return {
    title,
    url: fullUrl,
    city,
    price: effectivePrice || price,
    bedrooms: Math.round(rooms),
    size_m2: Math.round(size_m2),
    source: "wohnungsboerse",
    source_id: sourceId,
    image_url: imageUrl,
    furnished:     features.furnished,
    pets_allowed:  features.pets_allowed,
    balcony:       features.balcony,
    elevator:      features.elevator,
    garden:        features.garden,
    bath:          features.bath,
    roof_terrace:  features.roof_terrace,
    parking:       features.parking,
    energy_label:  features.energy_label,
    property_type: features.property_type,
    district,
    postcode,
    extra_features: extraFeatures.length > 0 ? extraFeatures : null,
    target_categories: features.property_type ? [features.property_type] : null,
  };
}

async function fetchPage(
  pageUrl: string,
  cookies: string,
  city: string,
): Promise<{ listings: ParsedListing[]; botBlocked: boolean; botReason: string }> {
  const headers: Record<string, string> = {
    ...buildBrowserHeaders(WB_BASE),
    ...(cookies ? { cookie: cookies } : {}),
  };

  const resp = await fetchWithRetry(pageUrl, headers);
  if (!resp) {
    log(`[WB] No response for ${pageUrl} after retries`);
    return { listings: [], botBlocked: false, botReason: "" };
  }

  const contentType = resp.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
    log(`[WB] Unexpected content-type: ${contentType}`);
    return { listings: [], botBlocked: false, botReason: "" };
  }

  const html = await resp.text();
  const { blocked, reason } = isBotBlocked(html, resp.status);
  if (blocked) {
    log(`[WB] Bot-blocked on ${city} — ${reason} (HTML length=${html.length})`);
    return { listings: [], botBlocked: true, botReason: reason };
  }

  if (!resp.ok) {
    log(`[WB] HTTP ${resp.status} on ${pageUrl}`);
    return { listings: [], botBlocked: false, botReason: "" };
  }

  const $ = cheerio.load(html);
  const listings: ParsedListing[] = [];

  const $cards = $("section.search_result_container a[href*='/immodetail/'], a[href*='/immodetail/']");
  const seen = new Set<string>();

  $cards.each((_i, el) => {
    try {
      const parsed = parseListingCard($, el, city);
      if (parsed && !seen.has(parsed.source_id)) {
        seen.add(parsed.source_id);
        listings.push(parsed);
      }
    } catch (err: any) {
      log(`[WB] Card parse error: ${err.message}`);
    }
  });

  log(`[WB] Parsed ${listings.length} listings from ${pageUrl}`);
  return { listings, botBlocked: false, botReason: "" };
}

export async function fetchWohnungsboerseListings(city: string, options?: { maxPages?: number }): Promise<{
  listings: ParsedListing[];
  botBlocked: boolean;
  botReason: string;
  pagesAttempted: number;
  pagesFetched: number;
}> {
  const pagesToFetch = options?.maxPages ?? PAGES_TO_FETCH;
  const baseUrl = getWohnungsboerseUrl(city);
  if (!baseUrl) {
    log(`[WB] No URL mapping for city "${city}" — skipping`);
    return { listings: [], botBlocked: false, botReason: "", pagesAttempted: 0, pagesFetched: 0 };
  }

  log(`[WB] Fetching Wohnungsbörse ${city} listings (up to ${pagesToFetch} page${pagesToFetch === 1 ? "" : "s"}) — ${baseUrl}`);

  const cookies = await acquireSession();
  const allListings: ParsedListing[] = [];
  const seenIds = new Set<string>();
  let pagesAttempted = 0;
  let pagesFetched = 0;

  for (let page = 1; page <= pagesToFetch; page++) {
    pagesAttempted++;
    const pageUrl = buildPageUrl(baseUrl, page);
    const { listings, botBlocked, botReason } = await fetchPage(pageUrl, cookies, city);

    if (botBlocked) {
      return { listings: allListings, botBlocked: true, botReason, pagesAttempted, pagesFetched };
    }

    if (listings.length === 0) {
      if (page === 1) log(`[WB] No listings found on page 1 — possible format change`);
      else log(`[WB] Empty page ${page} — stopping pagination`);
      break;
    }

    let newOnPage = 0;
    for (const l of listings) {
      if (!seenIds.has(l.source_id)) {
        seenIds.add(l.source_id);
        allListings.push(l);
        newOnPage++;
      }
    }
    pagesFetched++;

    if (newOnPage === 0 && page > 1) {
      log(`[WB] No new listings on page ${page} — stopping`);
      break;
    }

    if (page < pagesToFetch) await delay(PAGE_DELAY_MS);
  }

  log(`[WB] Wohnungsbörse ${city}: fetched ${allListings.length} unique listings across ${pagesFetched} pages`);
  return { listings: allListings, botBlocked: false, botReason: "", pagesAttempted, pagesFetched };
}

export function createWohnungsboerseIngester(city: string, options?: { maxPages?: number }): Ingester {
  return {
    name: `wohnungsboerse:${city}`,
    async run(): Promise<IngestionResult> {
      if (!PHASE1_ENABLED_CITIES.has(city)) {
        log(`[WB] ${city} not in Phase 1 rollout (enabled: ${[...PHASE1_ENABLED_CITIES].join(", ")}) — skipping`);
        return { found: 0, inserted: 0, duplicates: 0, matches: 0, errors: 0 };
      }

      const { listings, botBlocked, botReason, pagesAttempted, pagesFetched } =
        await fetchWohnungsboerseListings(city, options);

      if (botBlocked) {
        log(`[WB] ${city} bot-blocked after ${pagesAttempted} attempt(s) — reason: ${botReason} — skipping cycle`);
        return { found: 0, inserted: 0, duplicates: 0, matches: 0, errors: 0 };
      }

      if (listings.length === 0) {
        log(`[WB] ${city}: no listings found (${pagesAttempted} pages attempted)`);
        return { found: 0, inserted: 0, duplicates: 0, matches: 0, errors: 0 };
      }

      const result = await insertAndMatchListings(listings);

      log(
        `[WB] Wohnungsbörse ${city} ingestion complete: ` +
        `found=${listings.length} pages=${pagesFetched} ` +
        `inserted=${result.inserted} duplicates=${result.duplicates} ` +
        `matches=${result.matches} errors=${result.errors}`
      );

      return { found: listings.length, ...result };
    },
  };
}
