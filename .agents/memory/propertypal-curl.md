---
name: PropertyPal TLS fingerprint block
description: PropertyPal WAF blocks Node.js fetch (h2 ALPN fingerprint); curl works from the same IP; execFile('curl') is the correct HTTP client for this source.
---

## Rule
Use `execFile('curl', ...)` — not Node.js `fetch` — as the HTTP client for the PropertyPal source.

## Why
PropertyPal uses Cloudflare WAF with JA3/JA4 TLS fingerprinting:
- **Node.js native fetch (undici)** advertises `h2` in ALPN → 403 from both Replit direct and ScraperAPI
- **curl** uses HTTP/1.1 TLS negotiation → 200 from the same Replit IP

Confirmed May 2026: `curl -s -H "User-Agent: Mac Chrome" https://www.propertypal.com/property-to-rent/dublin` → HTTP 200, 309KB, full `__NEXT_DATA__` with 33 listings. Node.js fetch same URL, same IP → HTTP 403.

## How to apply
- `execFile('curl', ['--silent', '--location', '--compressed', '--write-out', '\n__HTTP_STATUS__:%{http_code}', ...headers, url])` in `server/sources/ireland/propertypal/index.ts`
- Parse the sentinel line to extract HTTP status from stdout
- Use Mac-based User-Agent (not Windows) in the headers — also helps avoid fingerprinting

## PROPERTYPAL_PROXY_URL
Only use if it's a real curl proxy: `http://host:port` or `socks5://host:port`.
ScraperAPI URL-prefix format (`https://api.scraperapi.com/?api_key=KEY&url=`) is NOT a valid curl `-x` proxy — explicitly rejected with a log warning.
PropertyPal does NOT need a proxy from Replit's IP — direct curl works.

## Data path
`__NEXT_DATA__` → `pageProps.initialState.properties.data.results` (array of 12–30 listings)
Key fields: `id`, `shareURL`, `displayAddress`, `price.price` (numeric), `numBedrooms`, `coordinate.{latitude,longitude}`, `images[0].url`, `countryCode` (filter "GBR"=NI), `saleType.key` (filter "sale")
