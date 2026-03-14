import { log } from "../log";
import { getCitySlugs } from "./city-slugs";

export type CityTier = 1 | 2 | 3;

export interface TieredCity {
  name: string;
  tier: CityTier;
}

export const TIER_1_CITIES: string[] = [
  "Berlin",
  "Hamburg",
  "München",
  "Köln",
  "Frankfurt",
  "Stuttgart",
  "Düsseldorf",
  "Leipzig",
  "Dresden",
  "Hannover",
  "Nürnberg",
  "Bremen",
];

export const TIER_2_CITIES: string[] = [
  "Potsdam",
  "Mannheim",
  "Freiburg",
  "Heidelberg",
  "Bonn",
  "Münster",
  "Karlsruhe",
  "Augsburg",
  "Bielefeld",
  "Erfurt",
  "Magdeburg",
  "Lübeck",
  "Mainz",
  "Wiesbaden",
  "Offenbach",
  "Fürth",
];

function canonicalCity(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

export function buildScrapeQueue(
  userCities: string[],
  cycleNumber: number,
): TieredCity[] {
  const seen = new Map<string, TieredCity>();

  for (const c of TIER_1_CITIES) {
    seen.set(canonicalCity(c), { name: c, tier: 1 });
  }

  const runTier2 = cycleNumber % 2 === 0;

  if (runTier2) {
    for (const c of TIER_2_CITIES) {
      const key = canonicalCity(c);
      if (!seen.has(key)) {
        seen.set(key, { name: c, tier: 2 });
      }
    }
  }

  let dynamicCount = 0;
  let skippedCount = 0;

  for (const raw of userCities) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const key = canonicalCity(trimmed);
    if (seen.has(key)) continue;

    const slugs = getCitySlugs(trimmed);
    if (!slugs) {
      skippedCount++;
      continue;
    }

    seen.set(key, { name: trimmed, tier: 3 });
    dynamicCount++;
  }

  const queue = Array.from(seen.values());

  const t1 = queue.filter((c) => c.tier === 1).length;
  const t2 = queue.filter((c) => c.tier === 2).length;
  const t3 = queue.filter((c) => c.tier === 3).length;

  log(
    `[CITY-TIERS] Tier 1 cities: ${t1} (always-on)`,
    "ingest",
  );
  if (runTier2) {
    log(`[CITY-TIERS] Tier 2 cities: ${t2} (this cycle)`, "ingest");
  } else {
    log(
      `[CITY-TIERS] Tier 2 cities: skipped this cycle (${TIER_2_CITIES.length} available, runs every other cycle)`,
      "ingest",
    );
  }
  log(
    `[CITY-TIERS] Dynamic user cities: ${t3}${skippedCount > 0 ? ` (${skippedCount} unsupported skipped)` : ""}`,
    "ingest",
  );
  log(`[CITY-TIERS] Final scrape queue: ${queue.length} cities`, "ingest");

  return queue;
}
