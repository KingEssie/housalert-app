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

const TEST_MODE_CITIES = [
  "Berlin", "München", "Hamburg", "Köln", "Frankfurt",
  "Stuttgart", "Düsseldorf", "Leipzig", "Dresden", "Nürnberg",
];

const TEST_MODE_EXPIRES = new Date("2026-03-12T00:00:00Z");

export function isTestModeActive(): boolean {
  return new Date() < TEST_MODE_EXPIRES;
}

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
  testMode: boolean;
  cities: string[];
  durationSec: number;
}

let _running = false;
let _lastRunAt: string | null = null;
let _lastSuccessfulRunAt: string | null = null;
let _lastResult: IngestionReport | null = null;
let _lastError: string | null = null;
let _todayStats = { fetched: 0, inserted: 0, date: "" };

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function updateTodayStats(fetched: number, inserted: number) {
  const today = getTodayKey();
  if (_todayStats.date !== today) {
    _todayStats = { fetched: 0, inserted: 0, date: today };
  }
  _todayStats.fetched += fetched;
  _todayStats.inserted += inserted;
}

export function isRunning(): boolean {
  return _running;
}

export function getEnabledSources(): string[] {
  return ["wg-gesucht", "kleinanzeigen", "immowelt", "wohnungsboerse", "immoscout", "rentola", "nestpick", "immonet"];
}

export function getLastRunStatus(): {
  lastRunAt: string | null;
  lastSuccessfulRunAt: string | null;
  lastResult: IngestionReport | null;
  lastError: string | null;
  running: boolean;
  testMode: boolean;
  testModeExpires: string | null;
  todayFetched: number;
  todayInserted: number;
} {
  const today = getTodayKey();
  return {
    lastRunAt: _lastRunAt,
    lastSuccessfulRunAt: _lastSuccessfulRunAt,
    lastResult: _lastResult,
    lastError: _lastError,
    running: _running,
    testMode: isTestModeActive(),
    testModeExpires: isTestModeActive() ? TEST_MODE_EXPIRES.toISOString() : null,
    todayFetched: _todayStats.date === today ? _todayStats.fetched : 0,
    todayInserted: _todayStats.date === today ? _todayStats.inserted : 0,
  };
}

async function getActiveCities(): Promise<string[]> {
  const testMode = isTestModeActive();

  try {
    let profileCities: string[] = [];

    const { data: dataFull, error: errorFull } = await supabase
      .from("search_profiles")
      .select("city, city_name");

    if (!errorFull && dataFull) {
      const cities = new Set<string>();
      for (const row of dataFull as Array<{ city?: string; city_name?: string }>) {
        const c = (row.city_name || row.city || "").trim();
        if (c) cities.add(c);
      }
      profileCities = Array.from(cities);
    } else {
      log(`[ingest] search_profiles query error (city_name may not exist): ${errorFull?.message ?? "no data"}`, "ingest");

      const { data: dataBasic, error: errorBasic } = await supabase
        .from("search_profiles")
        .select("city");

      if (!errorBasic && dataBasic) {
        const cities = new Set<string>();
        for (const row of dataBasic as Array<{ city?: string }>) {
          const c = (row.city || "").trim();
          if (c) cities.add(c);
        }
        profileCities = Array.from(cities);
      } else {
        log(`[ingest] search_profiles fallback query also failed: ${errorBasic?.message ?? "no data"}`, "ingest");
      }
    }

    if (testMode) {
      const merged = new Set<string>([...TEST_MODE_CITIES, ...profileCities]);
      log(`[ingest] TEST MODE active — using ${merged.size} cities (${TEST_MODE_CITIES.length} default + ${profileCities.length} from profiles)`, "ingest");
      return Array.from(merged);
    }

    if (profileCities.length === 0) {
      log("[ingest] No active search profiles — no ingestion this run", "ingest");
      return [];
    }

    return profileCities;
  } catch (err: any) {
    log(`[ingest] getActiveCities exception: ${err.message}`, "ingest");

    if (testMode) {
      log(`[ingest] TEST MODE fallback — using ${TEST_MODE_CITIES.length} default cities`, "ingest");
      return [...TEST_MODE_CITIES];
    }

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
  const testMode = isTestModeActive();
  log(`[INGEST START] testMode=${testMode}`, "ingest");

  const sources: SourceReport[] = [];
  const total = { found: 0, inserted: 0, duplicates: 0, matches: 0, errors: 0 };

  try {
    const cities = await getActiveCities();
    log(`[ingest] Active cities (${cities.length}): ${cities.join(", ")}`, "ingest");

    if (cities.length === 0) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      log(`[INGEST COMPLETE] in ${duration}s — no cities to process`, "ingest");
      const report: IngestionReport = { sources, total, testMode, cities, durationSec: parseFloat(duration) };
      _lastResult = report;
      _lastRunAt = new Date().toISOString();
      return report;
    }

    for (const city of cities) {
      log(`[ingest] --- Ingesting for city: ${city} ---`, "ingest");
      const cityIngesters = buildIngestersForCity(city);

      for (const ingester of cityIngesters) {
        try {
          log(`  Running ${ingester.name}...`, "ingest");
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
            `  ${ingester.name}: found=${result.found} ins=${result.inserted} dup=${result.duplicates} match=${result.matches} err=${result.errors}`,
            "ingest"
          );

          total.found += result.found;
          total.inserted += result.inserted;
          total.duplicates += result.duplicates;
          total.matches += result.matches;
          total.errors += result.errors;
        } catch (err: any) {
          log(`  ${ingester.name} FAILED: ${err.message}`, "ingest");
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
      `[INGEST COMPLETE] in ${duration}s — cities=${cities.length} found=${total.found} inserted=${total.inserted} dup=${total.duplicates} matches=${total.matches} errors=${total.errors}`,
      "ingest"
    );

    updateTodayStats(total.found, total.inserted);

    const report: IngestionReport = { sources, total, testMode, cities, durationSec: parseFloat(duration) };
    _lastResult = report;
    _lastRunAt = new Date().toISOString();
    if (total.errors === 0 || total.inserted > 0) {
      _lastSuccessfulRunAt = _lastRunAt;
    }
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
