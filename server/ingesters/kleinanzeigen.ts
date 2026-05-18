import * as cheerio from "cheerio";
import { createHash } from "crypto";
import { log } from "../log";
import type { Ingester, IngestionResult } from "./types";
import type { ParsedListing } from "./matching";
import { insertAndMatchListings } from "./matching";
import { getKleinanzeigenUrl } from "./city-slugs";
import {
  extractGarden, extractBath, extractRoofTerrace, extractParking,
  extractEnergyLabel, extractPropertyTypeFromText,
} from "./feature-extraction";
import { extractPostcodeFromText } from "./geocoding";

const KLEINANZEIGEN_BASE = "https://www.kleinanzeigen.de";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const PAGES_TO_FETCH = 3;
const PAGE_DELAY_MS   = 1800;
const FETCH_TIMEOUT_MS = 25_000;
const ROOT_TIMEOUT_MS  = 12_000;
const MAX_RETRIES      = 2;
const RETRY_BASE_MS    = 3_000;

const PHASE1_ENABLED_CITIES = new Set(["Berlin"]);

const BOT_MARKERS = [
  "cf-browser-verification",
  "_cf_chl_opt",
  "challenge-platform",
  "Just a moment...",
  "Checking your browser",
  "Enable JavaScript and cookies to continue",
  "__cf_chl_f_tk",
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
  const rawCookies: string[] = [];
  try {
    const setCookie = headers.getSetCookie?.() ?? [];
    for (const c of setCookie) rawCookies.push(c.split(";")[0].trim());
  } catch {
    const raw = headers.get("set-cookie") ?? "";
    for (const c of raw.split(",")) {
      const part = c.split(";")[0].trim();
      if (part.includes("=")) rawCookies.push(part);
    }
  }
  return rawCookies.join("; ");
}

function isBotBlocked(html: string, status: number): boolean {
  if (status === 403 || status === 429) return true;
  if (html.length < 8000 && status === 200) {
    for (const marker of BOT_MARKERS) {
      if (html.includes(marker)) return true;
    }
  }
  return false;
}

function buildPageUrl(baseUrl: string, page: number): string {
  if (page <= 1) return baseUrl;
  const parts = baseUrl.split("/s-wohnung-mieten/");
  if (parts.length !== 2) return baseUrl;
  const [base, rest] = parts;
  return `${base}/s-wohnung-mieten/${rest.split("/")[0]}/seite:${page}/${rest.split("/").slice(1).join("/")}`;
}

async function fetchWithTimeout(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { headers, signal: controller.signal });
    return resp;
  } catch (err: any) {
    if (err.name === "AbortError") throw new Error(`[KA] Fetch timed out after ${timeoutMs / 1000}s: ${url}`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await delay(RETRY_BASE_MS * Math.pow(2, attempt - 1));
      log(`[KA] Retry ${attempt}/${MAX_RETRIES}: ${url}`);
    }
    try {
      return await fetchWithTimeout(url, headers, timeoutMs);
    } catch (err: any) {
      if (attempt === MAX_RETRIES) {
        log(`[KA] All retries exhausted: ${err.message}`);
        return null;
      }
      log(`[KA] Attempt ${attempt + 1} failed (${err.message}), retrying in ${RETRY_BASE_MS * Math.pow(2, attempt)}ms`);
    }
  }
  return null;
}

async function acquireSession(): Promise<string> {
  try {
    const resp = await fetchWithTimeout(KLEINANZEIGEN_BASE, buildBrowserHeaders(), ROOT_TIMEOUT_MS);
    const cookies = parseCookies(resp.headers);
    if (cookies) log("[KA] Session established with cookies");
    return cookies;
  } catch (err: any) {
    log(`[KA] Root fetch failed (no session): ${err.message}`);
    return "";
  }
}

function extractSourceId(href: string): string {
  const m = href.match(/\/(\d+)-[^/]*$/);
  if (m) return m[1];
  const m2 = href.match(/-(\d+)\.html/);
  if (m2) return m2[1];
  return createHash("sha256").update(href).digest("hex").slice(0, 16);
}

function parsePrice(text: string): number {
  const clean = text.replace(/\./g, "").replace(",", ".");
  const m = clean.match(/(\d[\d.]*)\s*€/);
  if (m) return Math.round(parseFloat(m[1]));
  return 0;
}

function parseWarmRent(text: string): number | null {
  const patterns = [
    /warmmiete\s*:?\s*([\d.,]+)\s*€/i,
    /warm\s*:?\s*([\d.,]+)\s*€/i,
    /inkl\.?\s*nk\s*:?\s*([\d.,]+)\s*€/i,
    /\bwarm\b[^€]{0,20}([\d.,]+)\s*€/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return Math.round(parseFloat(m[1].replace(/\./g, "").replace(",", ".")));
  }
  return null;
}

function parseSize(text: string): number {
  const m = text.match(/([\d.,]+)\s*m[²2]/);
  if (m) return Math.round(parseFloat(m[1].replace(",", ".")));
  return 0;
}

function parseRooms(text: string): number {
  const patterns = [
    /([\d,]+)\s*(?:Zimmer|Zi\.?)\b/i,
    /\b(\d)\s*-?\s*Raum/i,
    /\b(\d+(?:[,.]5)?)\s*ZKB\b/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return Math.floor(parseFloat(m[1].replace(",", ".")));
  }
  return 0;
}

const UNFURNISHED_RE = /unmöbliert|unfurnished|nicht\s*möbliert/i;
const FURNISHED_RE   = /möbliert|furnished|teilmöbliert|voll\s*möbliert/i;
const NO_PETS_RE     = /keine\s*haustiere|keine\s*tiere|no\s*pets|haustiere?\s*nicht\s*erlaubt/i;
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

  const hasNoElev = NO_ELEVATOR_RE.test(text);
  const hasElev   = ELEVATOR_RE.test(text);
  const elevator  = !hasElev ? null : hasNoElev ? false : true;

  return {
    furnished:    UNFURNISHED_RE.test(text) ? false : FURNISHED_RE.test(text) ? true : null,
    pets_allowed: NO_PETS_RE.test(text) ? false : PETS_RE.test(text) ? true : null,
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

const NON_DISTRICT_TERMS = new Set([
  "wohnung", "zimmer", "balkon", "terrasse", "dachterrasse", "garten", "keller",
  "aufzug", "fahrstuhl", "garage", "stellplatz", "parkplatz", "küche", "bad",
  "dusche", "badewanne", "möbliert", "unmöbliert", "apartment", "studio", "loft",
  "penthouse", "maisonette", "erstbezug", "bezugsfrei", "neubau", "altbau",
  "saniert", "renoviert", "mehr", "nur",
]);

const SKIP_LISTING_PATTERNS = [
  /\bnur\s*tausch\b/i,
  /\btauschwohnung\b/i,
  /\bwohnungstausch\b/i,
  /\bsuche\s*tausch\b/i,
];

function isSkippableListing(title: string, description: string): boolean {
  const text = `${title} ${description}`;
  return SKIP_LISTING_PATTERNS.some(p => p.test(text));
}

function extractDistrict(locationText: string, title: string, city: string): string | null {
  const cityLower = city.toLowerCase();

  function isUsefulPart(p: string): string | null {
    const cleaned = p.replace(/\s*\(\w+\)\s*$/, "").trim();
    if (!cleaned || cleaned.length <= 2) return null;
    if (/^\d{5}/.test(cleaned)) return null;
    if (cleaned.toLowerCase() === cityLower) return null;
    if (cleaned.toLowerCase().startsWith(cityLower)) {
      const after = cleaned.slice(city.length).replace(/^[\s\-–,]+/, "").trim();
      return after && after.length > 2 ? after : null;
    }
    return cleaned;
  }

  for (const sep of [" – ", " - ", " | ", "\n", ","]) {
    const parts = locationText.split(sep).map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      for (const part of parts) {
        const result = isUsefulPart(part);
        if (result) return result;
      }
    }
  }

  const spaceResult = isUsefulPart(locationText.trim());
  if (spaceResult && !spaceResult.toLowerCase().includes(cityLower)) return spaceResult;

  const inPattern = /\bin\s+([A-ZÄÖÜ][a-zäöüß]+(?:[- ][A-ZÄÖÜ][a-zäöüß]+){0,2})/;
  const inMatch = title.match(inPattern);
  if (inMatch) {
    const candidate = inMatch[1].trim();
    if (candidate.toLowerCase() !== cityLower && candidate.length > 2) return candidate;
  }

  const commaTrail = title.match(/,\s*([A-ZÄÖÜ][^,\d]{2,30})$/);
  if (commaTrail) {
    const candidate = commaTrail[1].trim();
    if (candidate.toLowerCase() !== cityLower) return candidate;
  }

  const dashTrail = title.match(/[–\-]\s*([A-ZÄÖÜ][a-zäöüß]+(?:[- ][A-ZÄÖÜ][a-zäöüß]+)?)[\s,]*$/);
  if (dashTrail) {
    const candidate = dashTrail[1].trim();
    if (candidate.toLowerCase() !== cityLower && candidate.length > 2 && !NON_DISTRICT_TERMS.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  return null;
}

function normalizeImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t || t.startsWith("data:")) return null;
  if (/placeholder|noimage|no-image|blank|spacer|1x1|logo|icon|\.svg/i.test(t)) return null;
  if (t.startsWith("//")) return "https:" + t;
  if (t.startsWith("http")) return t;
  return null;
}

function extractImage($card: cheerio.Cheerio<cheerio.Element>, $: cheerio.CheerioAPI): string | null {
  const imgEl = $card.find("img").first();
  for (const attr of ["src", "data-src", "data-lazy", "data-original", "data-lazy-src"]) {
    const val = normalizeImageUrl(imgEl.attr(attr));
    if (val) return val;
  }
  const srcset = imgEl.attr("srcset") ?? "";
  if (srcset) {
    const best = srcset.split(",")
      .map((s: string) => { const p = s.trim().split(/\s+/); return { url: p[0], w: parseInt(p[1] ?? "0") || 0 }; })
      .sort((a: {url: string; w: number}, b: {url: string; w: number}) => b.w - a.w)
      .map((c: {url: string; w: number}) => normalizeImageUrl(c.url))
      .find((u: string | null) => u != null);
    if (best) return best;
  }
  return null;
}

function parseListingCard($: cheerio.CheerioAPI, card: cheerio.Element, city: string): ParsedListing | null {
  const $card = $(card);

  const dataId   = $card.attr("data-adid");
  const dataHref = $card.attr("data-href") ?? "";

  let titleLink = $card.find("h2 a.ellipsis").first();
  if (!titleLink.length) titleLink = $card.find("a.ellipsis").first();
  if (!titleLink.length) titleLink = $card.find("h2 a").first();

  const title = titleLink.text().trim();
  const href  = titleLink.attr("href") || dataHref;
  if (!title || !href) return null;

  const fullUrl  = href.startsWith("http") ? href : KLEINANZEIGEN_BASE + href;
  const sourceId = dataId || extractSourceId(href);

  const tagsEl   = $card.find(".aditem-main--middle--tags, .simpletag");
  const tagsText = tagsEl.text();
  const priceEl  = $card.find(".aditem-main--middle--price-shipping--price, [class*='price']").first();
  const priceText = priceEl.text();

  const size     = parseSize(tagsText);
  const bedrooms = parseRooms(tagsText) || parseRooms(title);
  const price    = parsePrice(priceText);

  const descEl = $card.find(".aditem-main--middle--description, .text-module-begin").first();
  const descText = descEl.text().trim();

  if (isSkippableListing(title, descText)) return null;

  const allText = [title, tagsText, priceText, descText].join(" ");
  const warmRent = parseWarmRent(allText);
  const effectivePrice = warmRent && warmRent > price ? warmRent : price;

  const features = extractFeatures(allText);

  const locationEl  = $card.find(".aditem-main--top--left, .aditem-details").first();
  const locationText = locationEl.text().trim();
  const district    = extractDistrict(locationText, title, city);
  const postcode    = extractPostcodeFromText(locationText) || extractPostcodeFromText(title) || null;

  const imageUrl = extractImage($card, $);

  const targetCategories = features.property_type ? [features.property_type] : null;
  const extraFeatures: string[] = [];
  if (warmRent) extraFeatures.push(`warmmiete:${warmRent}`);
  if (features.property_type) extraFeatures.push(features.property_type);

  return {
    title,
    url: fullUrl,
    city,
    price: effectivePrice || price,
    bedrooms,
    size_m2: size,
    source: "kleinanzeigen",
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
    target_categories: targetCategories,
    extra_features: extraFeatures.length > 0 ? extraFeatures : null,
  };
}

async function fetchPage(
  pageUrl: string,
  cookies: string,
  city: string,
): Promise<{ listings: ParsedListing[]; botBlocked: boolean; pageHtml?: string }> {
  const headers: Record<string, string> = {
    ...buildBrowserHeaders(KLEINANZEIGEN_BASE),
    ...(cookies ? { cookie: cookies } : {}),
  };

  const resp = await fetchWithRetry(pageUrl, headers);
  if (!resp) {
    log(`[KA] No response for ${pageUrl} after retries`);
    return { listings: [], botBlocked: false };
  }

  const isHtml = resp.headers.get("content-type")?.includes("text/html") ?? true;
  if (!isHtml) {
    log(`[KA] Unexpected content-type: ${resp.headers.get("content-type")}`);
    return { listings: [], botBlocked: false };
  }

  const html = await resp.text();

  if (isBotBlocked(html, resp.status)) {
    const reason = resp.status !== 200 ? `HTTP ${resp.status}` : "Cloudflare challenge in HTML";
    log(`[KA] Bot-blocked on ${city} (${reason}) — HTML length=${html.length}`);
    return { listings: [], botBlocked: true };
  }

  if (!resp.ok) {
    log(`[KA] HTTP ${resp.status} on ${pageUrl}`);
    return { listings: [], botBlocked: false };
  }

  const $ = cheerio.load(html);
  const listings: ParsedListing[] = [];

  $("article.aditem").each((_i, el) => {
    try {
      const parsed = parseListingCard($, el, city);
      if (parsed) listings.push(parsed);
    } catch (err: any) {
      log(`[KA] Card parse error: ${err.message}`);
    }
  });

  log(`[KA] Parsed ${listings.length} listings from ${pageUrl}`);
  return { listings, botBlocked: false, pageHtml: html };
}

export async function fetchKleinanzeigenListings(city: string): Promise<{
  listings: ParsedListing[];
  botBlocked: boolean;
  pagesAttempted: number;
  pagesFetched: number;
}> {
  const baseUrl = getKleinanzeigenUrl(city);
  if (!baseUrl) {
    log(`[KA] No URL mapping for city "${city}" — skipping`);
    return { listings: [], botBlocked: false, pagesAttempted: 0, pagesFetched: 0 };
  }

  log(`[KA] Fetching Kleinanzeigen ${city} listings (${PAGES_TO_FETCH} pages)`);

  const cookies = await acquireSession();
  const allListings: ParsedListing[] = [];
  const seenSourceIds = new Set<string>();
  let pagesAttempted = 0;
  let pagesFetched = 0;

  for (let page = 1; page <= PAGES_TO_FETCH; page++) {
    pagesAttempted++;
    const pageUrl = buildPageUrl(baseUrl, page);

    const { listings, botBlocked } = await fetchPage(pageUrl, cookies, city);

    if (botBlocked) {
      return { listings: allListings, botBlocked: true, pagesAttempted, pagesFetched };
    }

    if (listings.length === 0 && page > 1) {
      log(`[KA] Empty page ${page} — stopping pagination`);
      break;
    }

    let newOnPage = 0;
    for (const listing of listings) {
      if (!seenSourceIds.has(listing.source_id)) {
        seenSourceIds.add(listing.source_id);
        allListings.push(listing);
        newOnPage++;
      }
    }
    pagesFetched++;

    if (newOnPage === 0 && page > 1) {
      log(`[KA] No new listings on page ${page} — stopping`);
      break;
    }

    if (page < PAGES_TO_FETCH) await delay(PAGE_DELAY_MS);
  }

  log(`[KA] Kleinanzeigen ${city}: fetched ${allListings.length} unique listings across ${pagesFetched} pages`);
  return { listings: allListings, botBlocked: false, pagesAttempted, pagesFetched };
}

export function createKleinanzeigenIngester(city: string): Ingester {
  return {
    name: `kleinanzeigen:${city}`,
    async run(): Promise<IngestionResult> {
      if (!PHASE1_ENABLED_CITIES.has(city)) {
        log(`[KA] ${city} not in Phase 1 rollout (enabled: ${[...PHASE1_ENABLED_CITIES].join(", ")}) — skipping`);
        return { found: 0, inserted: 0, duplicates: 0, matches: 0, errors: 0 };
      }

      const { listings, botBlocked, pagesAttempted, pagesFetched } =
        await fetchKleinanzeigenListings(city);

      if (botBlocked) {
        log(`[KA] ${city} bot-blocked after ${pagesAttempted} attempts — skipping this cycle`);
        return { found: 0, inserted: 0, duplicates: 0, matches: 0, errors: 0 };
      }

      if (listings.length === 0) {
        log(`[KA] ${city}: no listings found (${pagesAttempted} pages attempted)`);
        return { found: 0, inserted: 0, duplicates: 0, matches: 0, errors: 0 };
      }

      const result = await insertAndMatchListings(listings);

      log(
        `[KA] Kleinanzeigen ${city} ingestion complete: ` +
        `found=${listings.length} pages=${pagesFetched} ` +
        `inserted=${result.inserted} duplicates=${result.duplicates} ` +
        `matches=${result.matches} errors=${result.errors}`
      );

      return { found: listings.length, ...result };
    },
  };
}
