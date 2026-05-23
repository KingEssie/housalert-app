/**
 * Shared proxy/fetch helpers for all Ireland sources.
 *
 * Each source can override with its own env var; all fall back to DAFT_PROXY_URL.
 *
 * Source-specific env vars:
 *   DAFT_PROXY_URL        — Daft.ie proxy (basic fetch works; no JS rendering needed)
 *   RENTIE_PROXY_URL      — Rent.ie proxy  (JS rendering required, e.g. add &render=true)
 *   MYHOME_PROXY_URL      — MyHome.ie proxy (JS rendering required, e.g. add &render=true)
 *   LETIE_PROXY_URL       — Let.ie proxy  (JS rendering required; Daft-powered, use render=true)
 *   PROPERTYIE_PROXY_URL   — Property.ie proxy (blocked via ScraperAPI; needs capable proxy)
 *   PROPERTYPAL_PROXY_URL  — PropertyPal proxy (direct fetch preferred; proxy fallback acceptable, no render=true needed)
 *
 * Supported proxy URL formats:
 *   ScraperAPI prefix:  https://api.scraperapi.com?api_key=KEY&url=
 *   JS rendering:       https://api.scraperapi.com?api_key=KEY&render=true&url=
 *   Template {url}:     https://proxy.example.com/fetch?target={url}
 *   Direct override:    https://internal-mirror.example.com/source-page
 */

export const FETCH_TIMEOUT_MS = 25_000;

/** Resolve the proxy URL to use for a given source. Falls back to DAFT_PROXY_URL. */
function resolveProxy(sourceEnvVar: string): string {
  let val = (process.env[sourceEnvVar] || process.env.DAFT_PROXY_URL || "").replace(/\s+/g, "");
  // Guard: if the secret was saved as "KEY=value" instead of just "value", strip the prefix
  const eqIdx = val.indexOf("=");
  if (eqIdx > 0 && !val.startsWith("http") && val.slice(eqIdx + 1).startsWith("http")) {
    val = val.slice(eqIdx + 1);
  }
  return val;
}

export function buildProxyUrl(
  targetUrl: string,
  sourceEnvVar = "DAFT_PROXY_URL"
): { fetchUrl: string; method: "direct" | "proxy"; proxyUrl: string } {
  const proxyUrl = resolveProxy(sourceEnvVar);
  if (!proxyUrl) return { fetchUrl: targetUrl, method: "direct", proxyUrl: "" };

  if (proxyUrl.includes("{url}")) {
    return {
      fetchUrl: proxyUrl.replace("{url}", encodeURIComponent(targetUrl)),
      method: "proxy",
      proxyUrl,
    };
  }
  if (/[=&?]$/.test(proxyUrl)) {
    return {
      fetchUrl: `${proxyUrl}${encodeURIComponent(targetUrl)}`,
      method: "proxy",
      proxyUrl,
    };
  }
  return { fetchUrl: proxyUrl, method: "proxy", proxyUrl };
}

export function isProxyConfigured(sourceEnvVar = "DAFT_PROXY_URL"): boolean {
  return !!resolveProxy(sourceEnvVar);
}

/** True if the resolved proxy URL includes &render=true (JS rendering mode). */
export function isJsRenderingEnabled(sourceEnvVar: string): boolean {
  return resolveProxy(sourceEnvVar).includes("render=true");
}

export const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-IE,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control":   "no-cache",
  "Pragma":          "no-cache",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest":  "document",
  "Sec-Fetch-Mode":  "navigate",
  "Sec-Fetch-Site":  "same-origin",
  "Sec-Fetch-User":  "?1",
};

/** Fetch a page (direct or via proxy), returning { html, status, method }. */
export async function fetchPage(
  targetUrl: string,
  extraHeaders: Record<string, string> = {},
  sourceEnvVar = "DAFT_PROXY_URL"
): Promise<{ html: string | null; status: number | null; method: "direct" | "proxy"; error?: string }> {
  const { fetchUrl, method } = buildProxyUrl(targetUrl, sourceEnvVar);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(fetchUrl, {
      headers: { ...BROWSER_HEADERS, ...extraHeaders },
      signal:  controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return { html: null, status: res.status, method };
    const html = await res.text();
    return { html, status: res.status, method };
  } catch (err: any) {
    clearTimeout(timer);
    const msg = err.name === "AbortError"
      ? `Timed out after ${FETCH_TIMEOUT_MS / 1000}s`
      : err.message;
    return { html: null, status: null, method, error: msg };
  }
}

/** Extract and parse __NEXT_DATA__ from HTML. */
export function extractNextData(html: string): { json: any; isCloudflare: boolean } {
  const isCF =
    html.includes("cf-browser-verification") ||
    html.includes("cf_clearance") ||
    html.includes("Just a moment");
  const m = html.match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>\s*(\{[\s\S]+?\})\s*<\/script>/
  );
  if (!m) return { json: null, isCloudflare: isCF };
  try { return { json: JSON.parse(m[1]), isCloudflare: false }; }
  catch { return { json: null, isCloudflare: isCF }; }
}

export function parsePrice(raw: string): number | undefined {
  const cleaned = raw.replace(/[€,\s]/g, "");
  const m = cleaned.match(/(\d{3,6})/);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  return isNaN(n) || n <= 50 ? undefined : n;
}

export function parseBedrooms(raw: string): number | undefined {
  if (/studio/i.test(raw)) return 0;
  const m = raw.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : undefined;
}
