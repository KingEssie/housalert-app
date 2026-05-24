/**
 * Smoke-test for the Owen Reilly fetcher.
 * Run: npx tsx server/scripts/test-owenreilly.ts
 */
import { testFetch } from "../sources/ireland/owenreilly";

const BASE_URL =
  process.env.OWENREILLY_DUBLIN_URL ||
  "https://www.owenreilly.ie/property-status/for-rent/";

(async () => {
  console.log("=== Owen Reilly Fetch Test ===\n");
  console.log(`Target URL : ${BASE_URL}`);
  console.log(`Proxy      : ${process.env.OWENREILLY_PROXY_URL ? "(using OWENREILLY_PROXY_URL)" : "(direct fetch)"}\n`);

  const result = await testFetch();

  console.log(`Fetch method   : ${result.method}`);
  console.log(`HTTP status    : ${result.status ?? "n/a"}`);
  console.log(`Raw candidates : ${result.rawCount}`);
  console.log(`Normalized     : ${result.normalizedCount}`);
  if (result.error) console.log(`Error          : ${result.error}`);

  if (result.listings.length === 0) {
    console.log("\nNo listings found.");
    process.exit(0);
  }

  console.log(`\nFirst 5 listing(s):\n`);
  for (let i = 0; i < Math.min(result.listings.length, 5); i++) {
    const l = result.listings[i];
    console.log(`  [${i + 1}] ${l.title}`);
    console.log(`       ID       : ${l.externalId}`);
    console.log(`       URL      : ${l.url}`);
    console.log(`       Price    : ${l.price !== undefined ? `€${l.price}/mo` : "(no price)"}`);
    console.log(`       Beds     : ${l.bedrooms ?? "(unknown)"}`);
    console.log(`       Location : ${l.location ?? "(unknown)"}`);
    console.log(`       Image    : ${l.imageUrl ? l.imageUrl.slice(0, 70) : "(none)"}`);
    console.log();
  }
  

  console.log("Done.");
  process.exit(0);
})().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
