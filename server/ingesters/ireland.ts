import { log } from "../log";
import { irelandSources } from "../sources/ireland/registry";
import type { SourceListing } from "../sources/ireland/types";
import { insertAndMatchListings, type ParsedListing } from "./matching";
import { upsertSourceHealth } from "../monitoring/source-health";

const SOURCE_TIMEOUT_MS = 30_000;

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

function sourceToParsed(s: SourceListing, city: string): ParsedListing {
  return {
    title:    s.title,
    url:      s.url,
    city,
    price:    s.price    ?? 0,
    bedrooms: s.bedrooms ?? 0,
    size_m2:  s.size_m2  ?? 0,
    source:   s.source,
    source_id: s.externalId,
    image_url: s.imageUrl ?? null,
    district:  s.location ?? null,
    latitude:  s.latitude  ?? null,
    longitude: s.longitude ?? null,
    source_published_at: s.createdAt ? s.createdAt.toISOString() : null,
  };
}

export async function runIrelandIngestion(): Promise<IrelandIngestionResult> {
  const startedAt = new Date();
  const reports: IrelandSourceReport[] = [];
  const total = { found: 0, inserted: 0, duplicates: 0, matches: 0, errors: 0 };

  for (const src of irelandSources) {
    const srcStart = Date.now();
    let found = 0;
    let inserted = 0;
    let duplicates = 0;
    let matches = 0;
    let errors = 0;
    let errorMessage: string | undefined;

    try {
      let rawListings: SourceListing[] = [];

      try {
        rawListings = await Promise.race([
          src.fetchListings(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Timed out after ${SOURCE_TIMEOUT_MS / 1000}s`)),
              SOURCE_TIMEOUT_MS
            )
          ),
        ]);
      } catch (err: any) {
        log(`[ireland] ${src.name} fetch error: ${err.message}`, "ingest");
        errors = 1;
        errorMessage = err.message;
      }

      found = rawListings.length;

      if (rawListings.length > 0) {
        const parsed = rawListings.map(s => sourceToParsed(s, "Dublin"));
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
      log(`[ireland] ${src.name} unexpected error: ${err.message}`, "ingest");
      errors = 1;
      errorMessage = err.message;
    }

    const durationMs = Date.now() - srcStart;

    reports.push({
      name:      `${src.name} (Dublin)`,
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
      `[ireland]   ${src.name}:Dublin: found=${found} ins=${inserted} dup=${duplicates} match=${matches} err=${errors} [${durationMs}ms]`,
      "ingest"
    );
  }

  const durationSec = (Date.now() - startedAt.getTime()) / 1000;

  // Push results into source_health so the admin pipeline dashboard shows Ireland
  try {
    await upsertSourceHealth(
      { sources: reports as any, cityReports: [], total, cities: ["Dublin"], durationSec },
      startedAt
    );
  } catch (err: any) {
    log(`[ireland] source health update error: ${err.message}`, "ingest");
  }

  return { sources: reports, total, durationSec };
}
