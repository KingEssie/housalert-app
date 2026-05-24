/**
 * Manual smoke-test for the Ray Cooke Ireland source.
 *
 * Usage:
 *   npx tsx server/scripts/test-raycooke.ts
 */

import { testFetch } from "../sources/ireland/raycooke";

async function main() {
  console.log("=== Ray Cooke Ireland Source — Manual Test ===\n");

  const result = await testFetch();

  console.log(`Method:           ${result.method}`);
  console.log(`HTTP status:      ${result.status ?? "n/a"}`);
  console.log(`Raw candidates:   ${result.rawCount}`);
  console.log(`Normalized count: ${result.normalizedCount}`);
  if (result.error) console.log(`Error:            ${result.error}`);
  console.log();

  if (result.listings.length === 0) {
    console.log("No listings returned.");
    return;
  }

  console.log("── Sample listings (first 3) ──────────────────────────────────");
  for (const l of result.listings.slice(0, 3)) {
    console.log();
    console.log(`  Title:      ${l.title}`);
    console.log(`  Price:      ${l.price != null ? "€" + l.price + "/mo" : "(unknown)"}`);
    console.log(`  Location:   ${l.location}`);
    console.log(`  External ID: ${l.externalId}`);
    console.log(`  URL:        ${l.url}`);
    if (l.imageUrl) console.log(`  Image:      ${l.imageUrl.slice(0, 80)}…`);
  }

  console.log("\n── Validation ──────────────────────────────────────────────────");
  const withPrice    = result.listings.filter((l) => l.price != null).length;
  const withImage    = result.listings.filter((l) => l.imageUrl).length;
  const uniqueIds    = new Set(result.listings.map((l) => l.externalId)).size;
  console.log(`  Listings with price:  ${withPrice}/${result.normalizedCount}`);
  console.log(`  Listings with image:  ${withImage}/${result.normalizedCount}`);
  console.log(`  Unique external IDs:  ${uniqueIds}/${result.normalizedCount}`);
  console.log(`  All IDs unique:       ${uniqueIds === result.normalizedCount ? "✓ YES" : "✗ NO (duplicates!)"}`);

  console.log("\n── All listing IDs ─────────────────────────────────────────────");
  for (const l of result.listings) {
    console.log(`  ${l.externalId} — €${l.price ?? "?"}`);
  }
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
