import { log } from "../log";
import { irelandSources } from "../sources/ireland/registry";
import type { SourceListing } from "../sources/ireland/types";
import { insertAndMatchListings, type ParsedListing } from "./matching";
import { upsertSourceHealth } from "../monitoring/source-health";

const SOURCE_TIMEOUT_MS = 30_000;

/**
 * Cities to ingest for multi-city sources.
 * Dublin-only sources (dublinOnly: true) always run for Dublin only.
 *
 * Override via env var:
 *   IRELAND_CITIES=Dublin,Cork,Galway,Limerick,Waterford
 *
 * Dublin is always included and always first regardless of the env value.
 */
const IRELAND_INGEST_CITIES: string[] = (() => {
  const raw = (process.env.IRELAND_CITIES || "Dublin,Cork,Galway,Limerick,Waterford")
    .split(",")
    .map(c => c.trim())
    .filter(Boolean);
  if (!raw.includes("Dublin")) raw.unshift("Dublin");
  return raw;
})();

export interface IrelandSourceReport {
  name: string;
  found: number;
  inserted: number;
  duplicates: number;
  matches: number;
  errors: number;
  errorMessage?: string;
  durationMs: number;
}

export interface IrelandIngestionResult {
  sources: IrelandSourceReport[];
  total: {
    found: number;
    inserted: number;
    duplicates: number;
    matches: number;
    errors: number;
  };
  durationSec: number;
}

function sourceToParsed(s: SourceListing, defaultCity: string): ParsedListing {
  return {
    title:    s.title,
    url:      s.url,
    city:     s.city || defaultCity,
    price:    s.price    ?? 0,
    bedrooms: s.bedrooms ?? 0,
    size_m2:  s.size_m2  ?? 0,
    source:   s.source,
    source_id: s.externalId,
    image_url: s.imageUrl ?? null,
    district:  s.location ?? null,
    latitude:  s.latitude  ?? null,
    longitude: s.longitude ?? null,
    source_published_at: (s.createdAt && !isNaN(s.createdAt.getTime())) ? s.createdAt.toISOString() : null,
  };
}

async function runSourceForCity(
  src: typeof irelandSources[number],
  city: string,
  reports: IrelandSourceReport[],
  total: { found: number; inserted: number; duplicates: number; matches: number; errors: number },
): Promise<void> {
  const srcStart = Date.now();
  let found = 0, inserted = 0, duplicates = 0, matches = 0, errors = 0;
  let errorMessage: string | undefined;

  try {
    let rawListings: SourceListing[] = [];

    try {
      rawListings = await Promise.race([
        src.fetchListings(city),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Timed out after ${SOURCE_TIMEOUT_MS / 1000}s`)),
            SOURCE_TIMEOUT_MS
          )
        ),
      ]);
    } catch (err: any) {
      log(`[ireland] ${src.name}/${city} fetch error: ${err.message}`, "ingest");
      errors = 1;
      errorMessage = err.message;
    }

    found = rawListings.length;

    if (rawListings.length > 0) {
      const parsed = rawListings.map(s => sourceToParsed(s, city));
      const result = await insertAndMatchListings(parsed);
      inserted   = result.inserted;
      duplicates = result.duplicates;
      matches    = result.matches;
      errors    += result.errors;
      if (result.errors > 0 && !errorMessage) {
        errorMessage = `${result.errors} insert/match error(s)`;
      }
    }
  } catch (err: any) {
    log(`[ireland] ${src.name}/${city} unexpected error: ${err.message}`, "ingest");
    errors = 1;
    errorMessage = err.message;
  }

  const durationMs = Date.now() - srcStart;

  reports.push({
    name: `${src.name} (${city})`,
    found,
    inserted,
    duplicates,
    matches,
    errors,
    errorMessage,
    durationMs,
  });

  total.found      += found;
  total.inserted   += inserted;
  total.duplicates += duplicates;
  total.matches    += matches;
  total.errors     += errors;

  log(
    `[ireland]   ${src.name}:${city}: found=${found} ins=${inserted} dup=${duplicates} match=${matches} err=${errors} [${durationMs}ms]`,
    "ingest"
  );
}

export async function runIrelandIngestion(): Promise<IrelandIngestionResult> {
  const startedAt = new Date();
  const reports: IrelandSourceReport[] = [];
  const total = { found: 0, inserted: 0, duplicates: 0, matches: 0, errors: 0 };

  for (const src of irelandSources) {
    if (src.disabled) {
      log(
        `[ireland] ${src.name}: Source disabled due to high scraping cost — skipping` +
        (src.disabledReason ? ` (${src.disabledReason})` : ""),
        "ingest"
      );
      continue;
    }

    // Dublin-only sources (local agencies) run once for Dublin regardless of IRELAND_CITIES.
    // Multi-city sources (national aggregators) run once per configured ingest city.
    const citiesToRun = src.dublinOnly ? ["Dublin"] : IRELAND_INGEST_CITIES;

    for (const city of citiesToRun) {
      await runSourceForCity(src, city, reports, total);
    }
  }

  const durationSec = (Date.now() - startedAt.getTime()) / 1000;

  try {
    const allCities = [...new Set(
      reports.map(r => r.name.match(/\(([^)]+)\)$/)?.[1] ?? "Dublin")
    )];
    await upsertSourceHealth(
      { sources: reports as any, cityReports: [], total, cities: allCities, durationSec },
      startedAt
    );
  } catch (err: any) {
    log(`[ireland] source health update error: ${err.message}`, "ingest");
  }

  return { sources: reports, total, durationSec };
}
