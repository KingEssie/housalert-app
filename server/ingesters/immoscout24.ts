import * as cheerio from "cheerio";
import { createHash } from "crypto";
import { log } from "../log";
import type { Ingester, IngestionResult } from "./types";
import type { ParsedListing } from "./matching";
import { insertAndMatchListings } from "./matching";
import { getImmoScout24Url } from "./city-slugs";
import {
  extractGarden, extractBath, extractRoofTerrace, extractParking,
  extractEnergyLabel, extractPropertyTypeFromText,
} from "./feature-extraction";
import { extractPostcodeFromText } from "./geocoding";

const IS24_BASE = "https://www.immobilienscout24.de";
const IS24_EXPOSE_BASE = "https://www.immobilienscout24.de/expose";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const PAGES_TO_FETCH   = 3;
const PAGE_DELAY_MS    = 2000;
const FETCH_TIMEOUT_MS = 30_000;
const ROOT_TIMEOUT_MS  = 12_000;
const MAX_RETRIES      = 2;
const RETRY_BASE_MS    = 4_000;

const PHASE1_ENABLED_CITIES = new Set(["Berlin"]);

const DATA_QUALITY_MIN_PRICE_PCT    = 0.55;
const DATA_QUALITY_MIN_BEDROOMS_PCT = 0.40;
const DATA_QUALITY_MIN_SIZE_PCT     = 0.40;

const BOT_MARKERS = [
  "Ich bin kein Roboter",
  "Gleich geht's weiter",
  "AwsWafIntegration",
  "awswaf.com",
  "challenge.js",
  "challenge-platform",
  "cf-browser-verification",
  "Enable JavaScript and cookies to continue",
  "Just a moment",
  "imperva",
  "incapsula",
  "__cf_chl_f_tk",
  "kein Roboter",
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

function isBotBlocked(html: string, status: number): { blocked: boolean; reason: string } {
  if (status === 401) return { blocked: true, reason: `HTTP 401 Unauthorized` };
  if (status === 403) return { blocked: true, reason: `HTTP 403 Forbidden` };
  if (status === 429) return { blocked: true, reason: `HTTP 429 Rate Limited` };

  for (const marker of BOT_MARKERS) {
    if (html.includes(marker)) {
      const label = marker.length > 30 ? marker.slice(0, 30) + "…" : marker;
      return { blocked: true, reason: `Bot marker in HTML: "${label}"` };
    }
  }

  if (status === 200 && html.length < 8_000) {
    return { blocked: true, reason: `Suspiciously short 200 response (${html.length} bytes)` };
  }

  return { blocked: false, reason: "" };
}

function buildPageUrl(baseUrl: string, page: number): string {
  if (page <= 1) return baseUrl;
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}pagenumber=${page}`;
}

async function fetchWithTimeout(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } catch (err: any) {
    if (err.name === "AbortError") throw new Error(`[IS24] Fetch timed out after ${timeoutMs / 1000}s: ${url}`);
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
      log(`[IS24] Retry ${attempt}/${MAX_RETRIES}: ${url}`);
    }
    try {
      return await fetchWithTimeout(url, headers, timeoutMs);
    } catch (err: any) {
      if (attempt === MAX_RETRIES) {
        log(`[IS24] All retries exhausted: ${err.message}`);
        return null;
      }
      log(`[IS24] Attempt ${attempt + 1} failed (${err.message}), retrying in ${RETRY_BASE_MS * Math.pow(2, attempt)}ms`);
    }
  }
  return null;
}

async function acquireSession(): Promise<string> {
  try {
    const resp = await fetchWithTimeout(IS24_BASE, buildBrowserHeaders(), ROOT_TIMEOUT_MS);
    const cookies = parseCookies(resp.headers);
    if (cookies) log("[IS24] Session established with cookies");
    return cookies;
  } catch (err: any) {
    log(`[IS24] Root fetch failed (no session): ${err.message}`);
    return "";
  }
}

function extractSourceId(href: string): string {
  const m = href.match(/\/expose\/(\d+)/i);
  if (m) return m[1];
  const m2 = href.match(/(\d{6,12})/);
  if (m2) return m2[1];
  return createHash("sha256").update(href).digest("hex").slice(0, 16);
}

function parsePrice(raw: string): number {
  const clean = raw.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : Math.round(n);
}

function parseFloat2(raw: string): number {
  const clean = raw.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(clean.match(/([\d.]+)/)?.[1] ?? "");
  return isNaN(n) ? 0 : n;
}

function parseRooms(text: string): number {
  const patterns = [
    /([\d,]+)\s*(?:Zimmer|Zi\.?)\b/i,
    /\b(\d)\s*-?\s*Raum/i,
    /^([\d,]+)$/,
  ];
  for (const p of patterns) {
    const m = text.trim().match(p);
    if (m) return Math.floor(parseFloat(m[1].replace(",", ".")));
  }
  return 0;
}

function parseSize(text: string): number {
  const m = text.match(/([\d.,]+)\s*m[²2]/);
  if (m) return Math.round(parseFloat2(m[1]));
  return 0;
}

function parseWarmRent(text: string): number | null {
  const patterns = [
    /warmmiete\s*:?\s*([\d.,]+)\s*€/i,
    /warm\s*:?\s*([\d.,]+)\s*€/i,
    /inkl\.?\s*nk\s*:?\s*([\d.,]+)\s*€/i,
    /\bgesamtmiete\b[^€]{0,30}([\d.,]+)\s*€/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return Math.round(parseFloat(m[1].replace(/\./g, "").replace(",", ".")));
  }
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
  const hasNoElev = NO_ELEVATOR_RE.test(text);
  const hasElev   = ELEVATOR_RE.test(text);
  const elevator  = !hasElev ? null : hasNoElev ? false : true;
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

function normalizeImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t || t.startsWith("data:")) return null;
  if (/placeholder|noimage|no-image|blank|spacer|1x1|logo|icon|\.svg/i.test(t)) return null;
  if (t.startsWith("//")) return "https:" + t;
  if (t.startsWith("http")) return t;
  return null;
}

function extractImageFromCard($card: cheerio.Cheerio<cheerio.Element>, $: cheerio.CheerioAPI): string | null {
  const img = $card.find("img").first();
  for (const attr of ["src", "data-src", "data-lazy", "data-original", "data-lazy-src"]) {
    const val = normalizeImageUrl(img.attr(attr));
    if (val) return val;
  }
  const srcset = img.attr("srcset") ?? "";
  if (srcset) {
    const best = srcset.split(",")
      .map((s: string) => { const p = s.trim().split(/\s+/); return { url: p[0], w: parseInt(p[1] ?? "0") || 0 }; })
      .sort((a: {w:number}, b: {w:number}) => b.w - a.w)
      .map((c: {url:string}) => normalizeImageUrl(c.url))
      .find((u: string | null) => u != null);
    if (best) return best;
  }
  return null;
}

function extractDistrict(address: string, city: string): string | null {
  const cityLower = city.toLowerCase();
  for (const sep of [" | ", " – ", " - ", ","]) {
    const parts = address.split(sep).map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      for (const part of parts) {
        if (!part || part.toLowerCase() === cityLower || /^\d/.test(part)) continue;
        if (part.toLowerCase().startsWith(cityLower)) {
          const after = part.slice(city.length).replace(/^[\s\-–,]+/, "").trim();
          if (after && after.length > 2) return after;
          continue;
        }
        if (part.length > 2 && part.length < 50) return part;
      }
    }
  }
  if (address.toLowerCase().startsWith(cityLower)) {
    const after = address.slice(city.length).replace(/^[\s\-–,|]+/, "").trim();
    if (after && after.length > 2 && !/^\d/.test(after)) return after;
  }
  return null;
}

interface Is24JsonEntry {
  id?: string | number;
  realEstate?: {
    title?: string;
    baseRent?: number;
    calculatedTotalRent?: { rent?: { value?: number } };
    livingSpace?: number;
    numberOfRooms?: number;
    energyConsumptionContainsWarmWater?: boolean;
    address?: {
      city?: string;
      quarter?: string;
      postcode?: string;
      street?: string;
      houseNumber?: string;
    };
    titlePicture?: {
      url?: string;
      urls?: Array<{ url?: { "@href"?: string } }>;
    };
    energyPerformanceCertificate?: { energyEfficiencyClass?: string };
    balcony?: boolean;
    garden?: boolean;
    cellar?: boolean;
    guestToilet?: boolean;
    lift?: boolean;
    interiorQuality?: string;
    heatingType?: string;
    condition?: string;
    builtInKitchen?: boolean;
    parkingSpaceType?: string;
    type?: string;
  };
}

function parseJsonEntry(entry: Is24JsonEntry, city: string): ParsedListing | null {
  const re = entry.realEstate;
  if (!re) return null;

  const exposeId = String(entry.id ?? "").replace(/\D/g, "");
  if (!exposeId) return null;

  const title = re.title?.trim() || "";
  if (!title) return null;

  const url = `${IS24_EXPOSE_BASE}/${exposeId}`;
  const baseRent = re.baseRent ?? 0;
  const warmRentVal = re.calculatedTotalRent?.rent?.value ?? 0;
  const price = warmRentVal > baseRent ? warmRentVal : (baseRent || warmRentVal);

  const size_m2 = re.livingSpace ? Math.round(re.livingSpace) : 0;
  const bedrooms = re.numberOfRooms ? Math.floor(re.numberOfRooms) : 0;

  const addr = re.address ?? {};
  const quarter = addr.quarter?.trim() || null;
  const postcode = addr.postcode?.trim() || null;
  const street   = addr.street ? `${addr.street}${addr.houseNumber ? " " + addr.houseNumber : ""}`.trim() : null;
  const district = quarter && quarter.toLowerCase() !== city.toLowerCase() ? quarter : null;

  let imageUrl: string | null = null;
  if (re.titlePicture) {
    const tp = re.titlePicture;
    if (tp.url) {
      imageUrl = normalizeImageUrl(tp.url);
    } else if (tp.urls && tp.urls.length > 0) {
      for (const u of tp.urls) {
        const href = u.url?.["@href"];
        if (href) { imageUrl = normalizeImageUrl(href); if (imageUrl) break; }
      }
    }
  }

  const allText = [title, quarter, re.interiorQuality, re.heatingType, re.type, re.condition].filter(Boolean).join(" ");
  const features = extractFeatures(allText);

  const balcony   = re.balcony  != null ? re.balcony  : features.balcony;
  const garden    = re.garden   != null ? re.garden   : features.garden;
  const elevator  = re.lift     != null ? re.lift     : features.elevator;
  const parking   = re.parkingSpaceType ? true : features.parking;
  const furnished = re.builtInKitchen != null ? features.furnished : features.furnished;

  const energyClass = re.energyPerformanceCertificate?.energyEfficiencyClass
    ?? features.energy_label;

  const rentType = warmRentVal > 0 && warmRentVal > baseRent ? "warm" : "kalt";
  const extraFeatures: string[] = [`renttype:${rentType}`];
  if (warmRentVal > 0) extraFeatures.push(`warmmiete:${Math.round(warmRentVal)}`);
  if (features.property_type) extraFeatures.push(features.property_type);

  return {
    title,
    url,
    city,
    price: Math.round(price),
    bedrooms,
    size_m2,
    source: "immoscout24",
    source_id: exposeId,
    image_url: imageUrl,
    furnished,
    pets_allowed:  features.pets_allowed,
    balcony,
    elevator,
    garden,
    bath:          features.bath,
    roof_terrace:  features.roof_terrace,
    parking,
    energy_label:  energyClass,
    property_type: features.property_type,
    district,
    postcode,
    street,
    extra_features: extraFeatures.length > 0 ? extraFeatures : null,
    target_categories: features.property_type ? [features.property_type] : null,
  };
}

function extractFromJson(html: string, city: string): ParsedListing[] | null {
  const jsonPatterns = [
    /<script[^>]+id=["']result-list-model["'][^>]*>([\s\S]*?)<\/script>/i,
    /<script[^>]+type=["']application\/json["'][^>]*id=["'][^"']*result[^"']*["'][^>]*>([\s\S]*?)<\/script>/i,
  ];

  let rawJson: string | null = null;
  for (const pattern of jsonPatterns) {
    const m = html.match(pattern);
    if (m) { rawJson = m[1].trim(); break; }
  }

  if (!rawJson) {
    const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    for (const m of scriptMatches) {
      const content = m[1];
      if (content.includes("resultListEntries") || content.includes("IS24.resultList")) {
        rawJson = content;
        break;
      }
    }
  }

  if (!rawJson) return null;

  try {
    let parsed: any;

    const jsonObjMatch = rawJson.match(/IS24\.resultList\s*=\s*(\{[\s\S]*\});?\s*$/m)
      ?? rawJson.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*\});?\s*$/m);

    if (jsonObjMatch) {
      parsed = JSON.parse(jsonObjMatch[1]);
    } else {
      parsed = JSON.parse(rawJson);
    }

    let entries: Is24JsonEntry[] = [];

    if (parsed?.resultList?.resultListEntries) {
      const outer = parsed.resultList.resultListEntries;
      for (const group of outer) {
        if (Array.isArray(group)) entries.push(...group);
        else if (group?.resultEntry) entries.push(group.resultEntry);
        else if (group?.id) entries.push(group);
      }
    } else if (parsed?.resultListEntries) {
      const outer = parsed.resultListEntries;
      for (const g of outer) {
        if (Array.isArray(g)) entries.push(...g);
        else if (g?.resultEntry) entries.push(g.resultEntry);
        else if (g?.id) entries.push(g);
      }
    } else if (parsed?.searchResponseModel?.["resultlist.resultList"]?.resultListEntries) {
      const outer = parsed.searchResponseModel["resultlist.resultList"].resultListEntries;
      for (const g of (Array.isArray(outer) ? outer : [])) {
        if (Array.isArray(g)) entries.push(...g);
        else if (g?.["resultEntry"]) entries.push(g["resultEntry"]);
      }
    }

    if (entries.length === 0) return null;

    const listings: ParsedListing[] = [];
    for (const entry of entries) {
      try {
        const parsed = parseJsonEntry(entry, city);
        if (parsed) listings.push(parsed);
      } catch { }
    }

    return listings.length > 0 ? listings : null;
  } catch (err: any) {
    log(`[IS24] JSON parse error: ${err.message}`);
    return null;
  }
}

function extractFromHtml(html: string, city: string): ParsedListing[] {
  const $ = cheerio.load(html);
  const listings: ParsedListing[] = [];
  const seen = new Set<string>();

  const selectors = [
    "li[data-id] article",
    "li.result-list__listing",
    "article.result-list-entry",
    "[data-obfuscated-id]",
    "div[data-id][class*='result']",
  ];

  let $cards = $();
  for (const sel of selectors) {
    $cards = $(sel);
    if ($cards.length > 0) break;
  }

  $cards.each((_i, el) => {
    try {
      const $card = $(el);

      const dataId = $card.attr("data-id")
        ?? $card.closest("li[data-id]").attr("data-id")
        ?? $card.attr("data-obfuscated-id")
        ?? "";

      const linkEl = $card.find("a[href*='/expose/']").first();
      const href = linkEl.attr("href") ?? "";
      if (!href.includes("/expose/")) return;

      const sourceId = dataId || extractSourceId(href);
      if (!sourceId || seen.has(sourceId)) return;
      seen.add(sourceId);

      const fullUrl = href.startsWith("http") ? href : IS24_BASE + href;

      const titleEl = $card.find(
        ".result-list-entry__brand-title, h5 a, .result-list-entry h5, h2 a, h3 a"
      ).first();
      const title = titleEl.text().trim() || linkEl.attr("title")?.trim() || "";
      if (!title) return;

      const priceRaw = $card.find(
        ".result-list-entry--price, [class*='price'], dl dd:first-child"
      ).first().text().trim();
      const price = parsePrice(priceRaw);

      const criteriaText = $card.find(
        ".result-list-entry__criteria, [class*='criteria'], dl"
      ).text();

      const bedrooms = parseRooms(criteriaText);
      const size_m2  = parseSize(criteriaText);

      const allText = [$card.text()].join(" ");
      const warmRent = parseWarmRent(allText);
      const effectivePrice = warmRent && warmRent > price ? warmRent : price;

      const addressEl = $card.find(
        ".result-list-entry__address, [class*='address'], .result-list-entry__map-link"
      ).first();
      const addressText = addressEl.text().trim();
      const district  = extractDistrict(addressText, city);
      const postcode  = extractPostcodeFromText(addressText) || null;

      const imageUrl = extractImageFromCard($card, $);
      const features = extractFeatures(allText);

      const rentType = warmRent ? "warm" : "kalt";
      const extraFeatures: string[] = [`renttype:${rentType}`];
      if (warmRent) extraFeatures.push(`warmmiete:${warmRent}`);

      listings.push({
        title,
        url: fullUrl,
        city,
        price: effectivePrice || price,
        bedrooms,
        size_m2,
        source: "immoscout24",
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
        extra_features: extraFeatures,
      });
    } catch (err: any) {
      log(`[IS24] HTML card parse error: ${err.message}`);
    }
  });

  return listings;
}

function checkDataQuality(
  listings: ParsedListing[]
): { ok: boolean; pricePct: number; bedsPct: number; sizePct: number; reason?: string } {
  if (listings.length === 0) return { ok: true, pricePct: 1, bedsPct: 1, sizePct: 1 };

  const n = listings.length;
  const pricePct  = listings.filter(l => l.price > 0).length / n;
  const bedsPct   = listings.filter(l => l.bedrooms > 0).length / n;
  const sizePct   = listings.filter(l => l.size_m2 > 0).length / n;

  if (pricePct < DATA_QUALITY_MIN_PRICE_PCT) {
    return { ok: false, pricePct, bedsPct, sizePct, reason: `Price coverage ${Math.round(pricePct * 100)}% < ${Math.round(DATA_QUALITY_MIN_PRICE_PCT * 100)}%` };
  }
  if (bedsPct < DATA_QUALITY_MIN_BEDROOMS_PCT) {
    return { ok: false, pricePct, bedsPct, sizePct, reason: `Bedrooms coverage ${Math.round(bedsPct * 100)}% < ${Math.round(DATA_QUALITY_MIN_BEDROOMS_PCT * 100)}%` };
  }
  if (sizePct < DATA_QUALITY_MIN_SIZE_PCT) {
    return { ok: false, pricePct, bedsPct, sizePct, reason: `Size coverage ${Math.round(sizePct * 100)}% < ${Math.round(DATA_QUALITY_MIN_SIZE_PCT * 100)}%` };
  }

  return { ok: true, pricePct, bedsPct, sizePct };
}

async function fetchPage(
  pageUrl: string,
  cookies: string,
  city: string,
): Promise<{ listings: ParsedListing[]; botBlocked: boolean; botReason: string; method: string }> {
  const headers: Record<string, string> = {
    ...buildBrowserHeaders(IS24_BASE),
    ...(cookies ? { cookie: cookies } : {}),
  };

  const resp = await fetchWithRetry(pageUrl, headers);
  if (!resp) {
    log(`[IS24] No response for ${pageUrl} after retries`);
    return { listings: [], botBlocked: false, botReason: "", method: "none" };
  }

  const contentType = resp.headers.get("content-type") ?? "";
  const isHtml = contentType.includes("text/html") || contentType.includes("text/plain");
  if (!isHtml && !contentType.includes("application/json")) {
    log(`[IS24] Unexpected content-type: ${contentType}`);
    return { listings: [], botBlocked: false, botReason: "", method: "unexpected-ct" };
  }

  const html = await resp.text();

  const { blocked, reason } = isBotBlocked(html, resp.status);
  if (blocked) {
    log(`[IS24] Bot-blocked on ${city} — ${reason} (HTML length=${html.length})`);
    return { listings: [], botBlocked: true, botReason: reason, method: "blocked" };
  }

  if (!resp.ok) {
    log(`[IS24] HTTP ${resp.status} on ${pageUrl}`);
    return { listings: [], botBlocked: false, botReason: "", method: `http-${resp.status}` };
  }

  const jsonListings = extractFromJson(html, city);
  if (jsonListings !== null) {
    log(`[IS24] Parsed ${jsonListings.length} listings from JSON on ${pageUrl}`);
    return { listings: jsonListings, botBlocked: false, botReason: "", method: "json" };
  }

  const htmlListings = extractFromHtml(html, city);
  log(`[IS24] Parsed ${htmlListings.length} listings from HTML on ${pageUrl}`);
  return { listings: htmlListings, botBlocked: false, botReason: "", method: "html" };
}

export async function fetchImmoScout24Listings(city: string): Promise<{
  listings: ParsedListing[];
  botBlocked: boolean;
  botReason: string;
  pagesAttempted: number;
  pagesFetched: number;
  method: string;
}> {
  const baseUrl = getImmoScout24Url(city);
  if (!baseUrl) {
    log(`[IS24] No URL mapping for city "${city}" — skipping`);
    return { listings: [], botBlocked: false, botReason: "", pagesAttempted: 0, pagesFetched: 0, method: "no-url" };
  }

  log(`[IS24] Fetching ImmoScout24 ${city} listings (${PAGES_TO_FETCH} pages) — ${baseUrl}`);

  const cookies = await acquireSession();
  const allListings: ParsedListing[] = [];
  const seenSourceIds = new Set<string>();
  let pagesAttempted = 0;
  let pagesFetched = 0;
  let finalMethod = "none";

  for (let page = 1; page <= PAGES_TO_FETCH; page++) {
    pagesAttempted++;
    const pageUrl = buildPageUrl(baseUrl, page);
    const { listings, botBlocked, botReason, method } = await fetchPage(pageUrl, cookies, city);

    if (botBlocked) {
      return { listings: allListings, botBlocked: true, botReason, pagesAttempted, pagesFetched, method };
    }

    if (listings.length === 0 && page > 1) {
      log(`[IS24] Empty page ${page} — stopping pagination`);
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

    if (method !== "none" && method !== "blocked") finalMethod = method;
    pagesFetched++;

    if (newOnPage === 0 && page > 1) {
      log(`[IS24] No new listings on page ${page} — stopping`);
      break;
    }

    if (page < PAGES_TO_FETCH) await delay(PAGE_DELAY_MS);
  }

  log(`[IS24] ImmoScout24 ${city}: fetched ${allListings.length} unique listings across ${pagesFetched} pages (method=${finalMethod})`);
  return { listings: allListings, botBlocked: false, botReason: "", pagesAttempted, pagesFetched, method: finalMethod };
}

export function createImmoScout24Ingester(city: string): Ingester {
  return {
    name: `immoscout24:${city}`,
    async run(): Promise<IngestionResult> {
      if (!PHASE1_ENABLED_CITIES.has(city)) {
        log(`[IS24] ${city} not in Phase 1 rollout (enabled: ${[...PHASE1_ENABLED_CITIES].join(", ")}) — skipping`);
        return { found: 0, inserted: 0, duplicates: 0, matches: 0, errors: 0 };
      }

      const { listings, botBlocked, botReason, pagesAttempted, pagesFetched, method } =
        await fetchImmoScout24Listings(city);

      if (botBlocked) {
        log(`[IS24] ${city} bot-blocked after ${pagesAttempted} attempt(s) — reason: ${botReason} — skipping cycle (errors: 0, this is expected behavior)`);
        return { found: 0, inserted: 0, duplicates: 0, matches: 0, errors: 0 };
      }

      if (listings.length === 0) {
        log(`[IS24] ${city}: no listings found (${pagesAttempted} pages attempted, method=${method})`);
        return { found: 0, inserted: 0, duplicates: 0, matches: 0, errors: 0 };
      }

      const quality = checkDataQuality(listings);
      const pct = (n: number) => `${Math.round(n * 100)}%`;
      log(
        `[IS24] ${city} data quality: price=${pct(quality.pricePct)} beds=${pct(quality.bedsPct)} size=${pct(quality.sizePct)} ok=${quality.ok}`
      );

      if (!quality.ok) {
        log(
          `[IS24] ${city} data quality below threshold — ${quality.reason}. ` +
          `Listings found (${listings.length}) but notifications suppressed. Check page format.`
        );
        return { found: listings.length, inserted: 0, duplicates: 0, matches: 0, errors: 1 };
      }

      const result = await insertAndMatchListings(listings);

      log(
        `[IS24] ImmoScout24 ${city} ingestion complete: ` +
        `found=${listings.length} pages=${pagesFetched} method=${method} ` +
        `inserted=${result.inserted} duplicates=${result.duplicates} ` +
        `matches=${result.matches} errors=${result.errors} ` +
        `price=${pct(quality.pricePct)} beds=${pct(quality.bedsPct)} size=${pct(quality.sizePct)}`
      );

      return { found: listings.length, ...result };
    },
  };
}
