import { createClient } from "@supabase/supabase-js";
import { log } from "../log";
import type { Ingester, IngestionResult } from "./types";
import { createWgGesuchtIngester } from "./wg-gesucht";
import { createKleinanzeigenIngester } from "./kleinanzeigen";
import { createImmoweltIngester } from "./immowelt";
import { createConfigIngester } from "./html-config";
import { buildSourcesForCity } from "./config/sources";
import { getCitySlugs, makeFallbackSlug } from "./city-slugs";

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export interface SourceReport {
  name: string;
  found: number;
  inserted: number;
  duplicates: number;
  matches: number;
  errors: number;
}

export interface IngestionReport {
  sources: SourceReport[];
  total: {
    found: number;
    inserted: number;
    duplicates: number;
    matches: number;
    errors: number;
  };
}

let _running = false;
let _lastRunAt: string | null = null;
let _lastResult: IngestionReport | null = null;
let _lastError: string | null = null;

export function isRunning(): boolean {
  return _running;
}

export function getEnabledSources(): string[] {
  return ["wg-gesucht", "kleinanzeigen", "immowelt", "wohnungsboerse", "immoscout", "rentola", "nestpick", "immonet"];
}

export function getLastRunStatus(): {
  lastRunAt: string | null;
  lastResult: IngestionReport | null;
  lastError: string | null;
  running: boolean;
} {
  return {
    lastRunAt: _lastRunAt,
    lastResult: _lastResult,
    lastError: _lastError,
    running: _running,
  };
}

async function getActiveCities(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("search_profiles")
      .select("city, city_name");

    if (error || !data) {
      log("[ingest] Could not fetch active cities — no ingestion this run", "ingest");
      return [];
    }

    const cities = new Set<string>();
    for (const row of data as Array<{ city?: string; city_name?: string }>) {
      const c = (row.city_name || row.city || "").trim();
      if (c) cities.add(c);
    }

    if (cities.size === 0) {
      log("[ingest] No active search profiles — no ingestion this run", "ingest");
      return [];
    }

    return Array.from(cities);
  } catch {
    return [];
  }
}

function buildIngestersForCity(city: string): Ingester[] {
  const ingesters: Ingester[] = [];

  ingesters.push(createWgGesuchtIngester(city));
  ingesters.push(createKleinanzeigenIngester(city));
  ingesters.push(createImmoweltIngester(city));

  const slugs = getCitySlugs(city);
  const slug = slugs?.slug ?? makeFallbackSlug(city);
  const configSources = buildSourcesForCity(city, slug);
  for (const cfg of configSources) {
    ingesters.push(createConfigIngester(cfg));
  }

  return ingesters;
}

export async function runAllIngesters(): Promise<IngestionReport> {
  if (_running) {
    throw new OverlapError("Ingest already running");
  }

  _running = true;
  _lastError = null;
  const startTime = Date.now();
  log("[INGEST START]", "ingest");

  const sources: SourceReport[] = [];
  const total = { found: 0, inserted: 0, duplicates: 0, matches: 0, errors: 0 };

  try {
    const cities = await getActiveCities();
    log(`[ingest] Active cities: ${cities.join(", ")}`, "ingest");

    for (const city of cities) {
      log(`[ingest] --- Ingesting for city: ${city} ---`, "ingest");
      const cityIngesters = buildIngestersForCity(city);

      for (const ingester of cityIngesters) {
        try {
          log(`Running ${ingester.name}...`, "ingest");
          const result = await ingester.run();

          const report: SourceReport = {
            name: ingester.name,
            found: result.found,
            inserted: result.inserted,
            duplicates: result.duplicates,
            matches: result.matches,
            errors: result.errors,
          };

          sources.push(report);
          log(
            `  ${ingester.name}: found=${result.found} inserted=${result.inserted} duplicates=${result.duplicates} matches=${result.matches} errors=${result.errors}`,
            "ingest"
          );

          total.found += result.found;
          total.inserted += result.inserted;
          total.duplicates += result.duplicates;
          total.matches += result.matches;
          total.errors += result.errors;
        } catch (err: any) {
          log(`  ${ingester.name} failed: ${err.message}`, "ingest");
          sources.push({
            name: ingester.name,
            found: 0,
            inserted: 0,
            duplicates: 0,
            matches: 0,
            errors: 1,
          });
          total.errors += 1;
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(
      `[INGEST COMPLETE] in ${duration}s — cities=${cities.length} inserted=${total.inserted} matches=${total.matches} errors=${total.errors}`,
      "ingest"
    );

    const report: IngestionReport = { sources, total };
    _lastResult = report;
    _lastRunAt = new Date().toISOString();
    return report;
  } catch (err: any) {
    _lastError = err.message;
    throw err;
  } finally {
    _running = false;
  }
}

export class OverlapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OverlapError";
  }
}
