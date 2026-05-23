/**
 * Unified Ireland source test — runs all three fetchers and reports results.
 *
 * Usage:
 *   npx tsx server/scripts/test-ireland.ts
 *   npx tsx server/scripts/test-ireland.ts daft
 *   npx tsx server/scripts/test-ireland.ts rentie
 *   npx tsx server/scripts/test-ireland.ts myhome
 *
 * Does NOT write to any database.
 */

import { fetchListings as fetchDaft } from "../sources/ireland/daft";
import { fetchListings as fetchRentie } from "../sources/ireland/rentie";
import { fetchListings as fetchMyhome } from "../sources/ireland/myhome";
import type { SourceListing } from "../sources/ireland/types";

const PROXY = process.env.DAFT_PROXY_URL
  ? process.env.DAFT_PROXY_URL.slice(0, 60) + "…"
  : "(none — direct fetch)";

function printSource(name: string, listings: SourceListing[], ms: number) {
  const icon = listings.length > 0 ? "✅" : "⚠️ ";
  console.log(`\n${icon} ${name.toUpperCase()} — ${listings.length} listing(s) in ${ms}ms`);
  if (listings.length === 0) {
    console.log("   (blocked or no data)");
    return;
  }
  const sample = listings.slice(0, 3);
  sample.forEach((l, i) => {
    console.log(`\n  [${i + 1}] ${l.title}`);
    console.log(`       ID       : ${l.externalId}`);
    console.log(`       URL      : ${l.url}`);
    console.log(`       Price    : ${l.price != null ? `€${l.price}/mo` : "–"}`);
    console.log(`       Beds     : ${l.bedrooms != null ? l.bedrooms : "–"}`);
    console.log(`       Location : ${l.location ?? "–"}`);
    if (l.latitude != null) console.log(`       Coords   : ${l.latitude?.toFixed(6)}, ${l.longitude?.toFixed(6)}`);
    if (l.imageUrl) console.log(`       Image    : ${l.imageUrl.slice(0, 80)}`);
  });
  if (listings.length > 3) {
    console.log(`\n  … and ${listings.length - 3} more`);
  }
}

async function runSource(
  name: string,
  fn: () => Promise<SourceListing[]>
): Promise<{ name: string; count: number; ms: number; ok: boolean }> {
  const t = Date.now();
  try {
    const listings = await fn();
    const ms = Date.now() - t;
    printSource(name, listings, ms);
    return { name, count: listings.length, ms, ok: listings.length > 0 };
  } catch (err: any) {
    const ms = Date.now() - t;
    console.log(`\n❌ ${name.toUpperCase()} — ERROR in ${ms}ms: ${err.message}`);
    return { name, count: 0, ms, ok: false };
  }
}

async function main() {
  const filter = process.argv[2]?.toLowerCase() ?? "all";

  console.log("=== Ireland Source Test ===");
  console.log(`Proxy : ${PROXY}`);
  console.log(`Filter: ${filter === "all" ? "all sources" : filter}\n`);

  const sources: Array<{ name: string; fn: () => Promise<SourceListing[]> }> = [
    { name: "daft",   fn: fetchDaft },
    { name: "rentie", fn: fetchRentie },
    { name: "myhome", fn: fetchMyhome },
  ].filter(s => filter === "all" || s.name === filter);

  if (sources.length === 0) {
    console.error(`Unknown source: ${filter}. Valid: daft, rentie, myhome, all`);
    process.exit(1);
  }

  // Run sequentially to avoid hammering the proxy concurrently
  const results = [];
  for (const { name, fn } of sources) {
    results.push(await runSource(name, fn));
  }

  console.log("\n─────────────────────────────────────");
  console.log("Summary:");
  for (const r of results) {
    const status = r.ok ? `✅ ${r.count} listings` : "⚠️  0 (blocked/empty)";
    console.log(`  ${r.name.padEnd(8)} ${status}  (${r.ms}ms)`);
  }

  const working = results.filter(r => r.ok).map(r => r.name);
  const total = results.reduce((s, r) => s + r.count, 0);
  console.log(`\nTotal: ${total} listings across ${working.length}/${results.length} sources`);
  if (working.length > 0) {
    console.log(`Ready for ingestion: ${working.join(", ")}`);
  }
  console.log("");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
