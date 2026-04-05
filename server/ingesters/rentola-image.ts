import { log } from "../log";
import * as cheerio from "cheerio";

const RENTOLA_BASE = "https://rentola.de";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const REQUEST_TIMEOUT_MS = 15_000;

const PLACEHOLDER_PATTERNS = /placeholder|default|noimage|no-image|blank|spacer|1x1|pixel\.gif|logo|icon|avatar|fallback|generic/i;

function normalizeImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("data:")) return null;
  if (PLACEHOLDER_PATTERNS.test(trimmed)) return null;
  if (trimmed.startsWith("//")) return "https:" + trimmed;
  if (trimmed.startsWith("http")) return trimmed;
  if (trimmed.startsWith("/")) return RENTOLA_BASE + trimmed;
  return null;
}

function bestFromSrcset(srcset: string): string | null {
  if (!srcset) return null;
  const candidates = srcset.split(",").map(s => {
    const parts = s.trim().split(/\s+/);
    const url = parts[0] || "";
    const descriptor = parts[1] || "1x";
    let weight = 1;
    if (descriptor.endsWith("w")) weight = parseInt(descriptor) || 1;
    else if (descriptor.endsWith("x")) weight = (parseFloat(descriptor) || 1) * 1000;
    return { url, weight };
  }).filter(c => c.url);
  candidates.sort((a, b) => b.weight - a.weight);
  for (const c of candidates) {
    const resolved = normalizeImageUrl(c.url);
    if (resolved) return resolved;
  }
  return null;
}

function extractImageFromEl($: cheerio.CheerioAPI, selector: string): string | null {
  const el = $(selector).first();
  if (!el.length) return null;
  for (const attr of ["src", "data-src", "data-lazy", "data-original", "data-lazy-src"]) {
    const val = normalizeImageUrl(el.attr(attr));
    if (val) return val;
  }
  const srcset = el.attr("srcset");
  if (srcset) {
    const val = bestFromSrcset(srcset);
    if (val) return val;
  }
  return null;
}

export function extractRentolaImage($: cheerio.CheerioAPI): { url: string; method: string } | null {
  const selectors = [
    "img[src*='rentola']",
    "img[data-src*='rentola']",
    "[data-testid='propertyTile'] img",
    ".property-image img",
    ".listing-image img",
    ".gallery img",
    ".carousel img",
    ".slider img",
    ".swiper img",
    ".detail-image img",
    ".image-gallery img",
    "picture source",
    "picture img",
  ];
  for (const sel of selectors) {
    const val = extractImageFromEl($, sel);
    if (val) return { url: val, method: "selector" };
  }

  const allImgs = $("img");
  for (let i = 0; i < allImgs.length; i++) {
    const img = $(allImgs[i]);
    for (const attr of ["src", "data-src", "data-lazy", "data-original", "data-lazy-src"]) {
      const raw = img.attr(attr) || "";
      if (raw && (raw.includes("rentola") || raw.includes("property") || raw.includes("listing"))) {
        const val = normalizeImageUrl(raw);
        if (val) return { url: val, method: "img-domain-scan" };
      }
    }
  }

  const scripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i++) {
    try {
      const json = JSON.parse($(scripts[i]).html() || "");
      const img = json?.image || json?.photo?.[0]?.contentUrl || json?.images?.[0];
      if (img) {
        const val = normalizeImageUrl(typeof img === "string" ? img : img?.url || img?.contentUrl || "");
        if (val) return { url: val, method: "json-ld" };
      }
    } catch {}
  }

  const nextData = $("script#__NEXT_DATA__").html();
  if (nextData) {
    try {
      const parsed = JSON.parse(nextData);
      const props = parsed?.props?.pageProps;
      if (props) {
        const imgCandidates = [
          props?.listing?.images?.[0]?.url,
          props?.listing?.images?.[0],
          props?.listing?.image,
          props?.listing?.mainImage,
          props?.property?.images?.[0]?.url,
          props?.property?.images?.[0],
          props?.property?.image,
        ];
        for (const c of imgCandidates) {
          if (typeof c === "string") {
            const val = normalizeImageUrl(c);
            if (val) return { url: val, method: "next-data" };
          }
        }
      }
    } catch {}
  }

  const stateScripts = $("script");
  for (let i = 0; i < stateScripts.length; i++) {
    const text = $(stateScripts[i]).html() || "";
    if (text.includes("__INITIAL_STATE__") || text.includes("window.__DATA__") || text.includes("initialProps")) {
      const imgMatch = text.match(/"image(?:Url|_url)?"\s*:\s*"(https?:\/\/[^"]+)"/);
      if (imgMatch) {
        const val = normalizeImageUrl(imgMatch[1]);
        if (val) return { url: val, method: "embedded-state" };
      }
      const imgArrayMatch = text.match(/"images"\s*:\s*\[\s*"(https?:\/\/[^"]+)"/);
      if (imgArrayMatch) {
        const val = normalizeImageUrl(imgArrayMatch[1]);
        if (val) return { url: val, method: "embedded-state" };
      }
    }
  }

  const ogImage = normalizeImageUrl($('meta[property="og:image"]').attr("content"));
  if (ogImage) return { url: ogImage, method: "og:image" };

  const twitterImage = normalizeImageUrl(
    $('meta[name="twitter:image"], meta[property="twitter:image"]').attr("content")
  );
  if (twitterImage) return { url: twitterImage, method: "twitter:image" };

  const contentImg = $("article img, main img, .main-content img, .detail-content img, section img, [role='main'] img").first();
  if (contentImg.length) {
    for (const attr of ["src", "data-src", "data-lazy", "data-original"]) {
      const val = normalizeImageUrl(contentImg.attr(attr));
      if (val) return { url: val, method: "generic-content" };
    }
    const srcset = contentImg.attr("srcset");
    if (srcset) {
      const val = bestFromSrcset(srcset);
      if (val) return { url: val, method: "generic-srcset" };
    }
  }

  return null;
}

const ALLOWED_HOSTS = ["rentola.de", "www.rentola.de", "rentola.com", "www.rentola.com"];

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith("." + h));
  } catch {
    return false;
  }
}

export async function fetchRentolaImage(listingUrl: string): Promise<{ url: string; method: string } | null> {
  if (!isAllowedUrl(listingUrl)) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const resp = await fetch(listingUrl, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.5",
        Referer: `${RENTOLA_BASE}/`,
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const html = await resp.text();
    const $ = cheerio.load(html);
    return extractRentolaImage($);
  } catch {
    return null;
  }
}
