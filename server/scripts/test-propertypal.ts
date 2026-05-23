/**
 * Manual PropertyPal fetch test
 *
 * Usage:
 *   npx tsx server/scripts/test-propertypal.ts
 *
 * Optional env vars:
 *   PROPERTYPAL_PROXY_URL       — proxy URL (ScraperAPI prefix, {url} template, or direct override)
 *   PROPERTYPAL_DUBLIN_RENT_URL — override the target PropertyPal page
 *
 * Falls back to DAFT_PROXY_URL if PROPERTYPAL_PROXY_URL is not set.
 * Does NOT write to any database.
 */

import { testFetch } from "../sources/ireland/propertypal/index";

async function main() {
  console.log("=== PropertyPal Fetch Test ===\n");
  console.log(`Target URL : ${process.env.PROPERTYPAL_DUBLIN_RENT_URL || "https://www.propertypal.com/property-to-rent/dublin"}`);
  console.log(`Proxy      : ${
    process.env.PROPERTYPAL_PROXY_URL
      ? process.env.PROPERTYPAL_PROXY_URL.slice(0, 60) + "…"
      : process.env.DAFT_PROXY_URL
      ? "(using DAFT_PROXY_URL) " + process.env.DAFT_PROXY_URL.slice(0, 40) + "…"
      : "(none — direct fetch)"
  }`);
  console.log("");

  let result;
  try {
    result = await testFetch();
  } catch (err: any) {
    console.error("Unexpected error:", err.message);
    process.exit(1);
  }

  console.log(`Fetch method   : ${result.method}`);
  console.log(`HTTP status    : ${result.status ?? "(no response)"}`);
  console.log(`Raw candidates : ${result.rawCount}`);
  console.log(`Normalized     : ${result.normalizedCount}`);
  if (result.error) console.log(`Error          : ${result.error}`);

  if (result.listings.length === 0) {
    console.log("\nNo listings extracted.");
    console.log(
      "\nTip: PropertyPal may apply bot protection. Try setting PROPERTYPAL_PROXY_URL:\n" +
      "  PROPERTYPAL_PROXY_URL=https://api.scraperapi.com?api_key=YOUR_KEY&url= npx tsx server/scripts/test-propertypal.ts"
    );
  } else {
    console.log(`\nFirst ${Math.min(3, result.listings.length)} listing(s):`);
    result.listings.slice(0, 3).forEach((l, i) => {
      console.log(`\n  [${i + 1}] ${l.title}`);
      console.log(`       ID       : ${l.externalId}`);
      console.log(`       URL      : ${l.url}`);
      console.log(`       Price    : ${l.price != null ? `€${l.price}/mo` : "–"}`);
      console.log(`       Beds     : ${l.bedrooms != null ? l.bedrooms : "–"}`);
      console.log(`       Location : ${l.location ?? "–"}`);
      if (l.latitude != null) console.log(`       Coords   : ${l.latitude}, ${l.longitude}`);
      if (l.imageUrl) console.log(`       Image    : ${l.imageUrl.slice(0, 80)}`);
    });
  }

  console.log("\nDone.\n");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
