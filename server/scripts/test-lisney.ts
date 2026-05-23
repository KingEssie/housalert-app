/**
 * Manual Lisney fetch test
 *
 * Usage:
 *   npx tsx server/scripts/test-lisney.ts
 *
 * Optional env vars:
 *   LISNEY_PROXY_URL      — proxy URL (falls back to DAFT_PROXY_URL)
 *   LISNEY_DUBLIN_URL     — override the Lisney to-let search URL
 *
 * Does NOT write to any database.
 */

import { testFetch } from "../sources/ireland/lisney/index";

async function main() {
  console.log("=== Lisney Fetch Test ===\n");
  console.log(
    `Target URL : ${
      process.env.LISNEY_DUBLIN_URL ||
      "https://www.lisney.com/property-status/to-let/"
    }`
  );
  console.log(
    `Proxy      : ${
      process.env.LISNEY_PROXY_URL
        ? process.env.LISNEY_PROXY_URL.slice(0, 60) + "…"
        : process.env.DAFT_PROXY_URL
        ? "(using DAFT_PROXY_URL) " +
          process.env.DAFT_PROXY_URL.slice(0, 40) +
          "…"
        : "(none — direct fetch)"
    }`
  );
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
  } else {
    console.log(`\nFirst ${Math.min(3, result.listings.length)} listing(s):`);
    result.listings.slice(0, 3).forEach((l, i) => {
      console.log(`\n  [${i + 1}] ${l.title}`);
      console.log(`       ID       : ${l.externalId}`);
      console.log(`       URL      : ${l.url}`);
      console.log(
        `       Price    : ${l.price != null ? `€${l.price}/mo` : "–"}`
      );
      console.log(
        `       Beds     : ${l.bedrooms != null ? l.bedrooms : "–"}`
      );
      console.log(`       Location : ${l.location ?? "–"}`);
      if (l.imageUrl) console.log(`       Image    : ${l.imageUrl.slice(0, 80)}`);
    });
  }

  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
