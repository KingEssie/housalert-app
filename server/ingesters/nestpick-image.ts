import { log } from "../log";
import * as cheerio from "cheerio";

const NESTPICK_BASE = "https://www.nestpick.com";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const REQUEST_TIMEOUT_MS = 20_000;

const PLACEHOLDER_PATTERNS = /placeholder|default|noimage|no-image|blank\.png|spacer|1x1|pixel\.gif|logo-default|loading\.svg|alert-banner/i;
const ICON_PATTERNS = /\/icon\/|\/logo\/|\/avatar\/|\/favicon/i;

const ALLOWED_HOSTS = ["www.nestpick.com", "nestpick.com", "images.nestpick.com"];

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith("." + h));
  } catch {
    return false;
  }
}

function normalizeImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("data:")) return null;
  if (PLACEHOLDER_PATTERNS.test(trimmed)) return null;
  if (ICON_PATTERNS.test(trimmed)) return null;
  if (trimmed.startsWith("//")) return "https:" + trimmed;
  if (trimmed.startsWith("http")) return trimmed;
  if (trimmed.startsWith("/")) return NESTPICK_BASE + trimmed;
  return null;
}

const CITY_SLUG_MAP: Record<string, string> = {
  "mannheim": "mannheim",
  "frankfurt": "frankfurt",
  "stuttgart": "stuttgart",
  "dresden": "dresden",
  "karlsruhe": "karlsruhe",
  "wiesbaden": "wiesbaden",
  "leipzig": "leipzig",
  "hamburg": "hamburg",
  "bremen": "bremen",
  "berlin": "berlin",
  "essen": "essen",
  "bonn": "bonn",
  "potsdam": "potsdam",
  "magdeburg": "magdeburg",
  "hannover": "hannover",
  "freiburg": "freiburg",
  "heidelberg": "heidelberg",
  "erfurt": "erfurt",
  "münchen": "munich",
  "munich": "munich",
  "köln": "cologne",
  "cologne": "cologne",
  "düsseldorf": "dusseldorf",
  "dusseldorf": "dusseldorf",
  "dortmund": "dortmund",
  "nürnberg": "nuremberg",
  "nuremberg": "nuremberg",
};

function cityToSlug(city: string): string {
  const lower = city.toLowerCase().trim();
  return CITY_SLUG_MAP[lower] || lower.replace(/\s+/g, "-").replace(/[äöüß]/g, m => {
    const map: Record<string, string> = { "ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss" };
    return map[m] || m;
  });
}

const MAX_PAGES = 5;
const searchPageCache = new Map<string, { pages: string[]; ts: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

async function fetchSinglePage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const resp = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.5",
        Referer: `${NESTPICK_BASE}/`,
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const html = await resp.text();
    if (html.length < 10_000) return null;
    return html;
  } catch {
    return null;
  }
}

async function fetchSearchPages(citySlug: string): Promise<string[]> {
  const cached = searchPageCache.get(citySlug);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.pages;

  const baseUrl = `${NESTPICK_BASE}/${citySlug}/`;
  if (!isAllowedUrl(baseUrl)) return [];

  const pages: string[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1 ? baseUrl : `${baseUrl}?page=${page}`;
    await new Promise(r => setTimeout(r, page > 1 ? 1500 : 0));
    const html = await fetchSinglePage(url);
    if (!html) break;
    pages.push(html);
    const hasMore = html.includes("pagination") && html.includes(`page=${page + 1}`);
    if (!hasMore) break;
  }

  if (pages.length > 0) {
    searchPageCache.set(citySlug, { pages, ts: Date.now() });
  }
  return pages;
}

export function extractNestpickImageFromSearch($: cheerio.CheerioAPI, sourceId: string): { url: string; method: string } | null {
  const card = $(`[data-id="${sourceId}"]`).first();
  if (!card.length) return null;

  const flickityImg = card.find("img[data-flickity-lazyload]").first();
  if (flickityImg.length) {
    const val = normalizeImageUrl(flickityImg.attr("data-flickity-lazyload"));
    if (val) return { url: val, method: "flickity-lazyload" };
  }

  for (const attr of ["data-src", "data-lazy", "data-original", "data-lazy-src", "src"]) {
    const imgs = card.find("img");
    for (let i = 0; i < imgs.length; i++) {
      const val = normalizeImageUrl($(imgs[i]).attr(attr));
      if (val) return { url: val, method: `card-${attr}` };
    }
  }

  const bgEl = card.find("[style*='background-image']").first();
  if (bgEl.length) {
    const style = bgEl.attr("style") || "";
    const match = style.match(/url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/);
    if (match) {
      const val = normalizeImageUrl(match[1]);
      if (val) return { url: val, method: "card-bg-image" };
    }
  }

  return null;
}

function extractSourceId(listingUrl: string): string | null {
  const match = listingUrl.match(/\/pick\/(\d+)\//);
  return match ? match[1] : null;
}

function extractCityFromUrl(listingUrl: string, title?: string): string | null {
  if (title) {
    const parts = title.split(",");
    if (parts.length >= 2) {
      const cityPart = parts[parts.length - 1].trim();
      if (cityPart) return cityPart;
    }
  }
  return null;
}

export async function fetchNestpickImage(
  listingUrl: string,
  opts?: { city?: string; sourceId?: string; title?: string }
): Promise<{ url: string; method: string } | null> {
  const sourceId = opts?.sourceId || extractSourceId(listingUrl);
  if (!sourceId) return null;

  const city = opts?.city || extractCityFromUrl(listingUrl, opts?.title);
  if (!city) return null;

  const slug = cityToSlug(city);
  const pages = await fetchSearchPages(slug);
  if (pages.length === 0) return null;

  for (const html of pages) {
    const $ = cheerio.load(html);
    const result = extractNestpickImageFromSearch($, sourceId);
    if (result) return result;
  }

  return null;
}

export function clearSearchCache() {
  searchPageCache.clear();
}
