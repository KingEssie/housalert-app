import { createClient } from "@supabase/supabase-js";
import { log } from "../log";
import type { Ingester, IngestionResult } from "./types";
import { createWgGesuchtIngester } from "./wg-gesucht";
import { createKleinanzeigenIngester } from "./kleinanzeigen";
import { createImmoweltIngester } from "./immowelt";
import { createConfigIngester } from "./html-config";
import { buildSourcesForCity } from "./config/sources";
import { getCitySlugs, makeFallbackSlug } from "./city-slugs";
import { areAlertsEnabled } from "../notifications";
import { flushMatchAlertBuffer, clearBuffer, getBufferSize } from "../notifications/buffer";
import { createFetchRun, completeFetchRun, failFetchRun } from "../user-matches";

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const GERMAN_CITIES = [
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
  "Bochum",
  "Bonn",
  "Mannheim",
  "Karlsruhe",
  "Wiesbaden",
  "Münster",
  "Augsburg",
  "Freiburg",
];

const INTER_CITY_DELAY_MS = 2000;

export interface SourceReport {
  name: string;
  found: number;
  inserted: number;
  duplicates: number;
  matches: number;
  errors: number;
}

export interface CityReport {
  city: string;
  found: number;
  inserted: number;
  duplicates: number;
  matches: number;
  errors: number;
}

export interface IngestionReport {
  sources: SourceReport[];
  cityReports: CityReport[];
  total: {
    found: number;
    inserted: number;
    duplicates: number;
    matches: number;
    errors: number;
  };
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

export interface SourceStatus {
  name: string;
  status: "active" | "broken" | "gone";
  note?: string;
}

const SOURCE_STATUSES: SourceStatus[] = [
  { name: "wg-gesucht", status: "active" },
  { name: "kleinanzeigen", status: "active" },
  { name: "immowelt", status: "active" },
  { name: "wohnungsboerse", status: "active" },
  { name: "immoscout", status: "broken", note: "Returns 401 — bot-blocked" },
  { name: "rentola", status: "active" },
  { name: "nestpick", status: "active" },
  { name: "immonet", status: "gone", note: "Returns 410 — service discontinued" },
];

export function getSourceStatuses(): SourceStatus[] {
  return SOURCE_STATUSES;
}

export function getEnabledSources(): string[] {
  return SOURCE_STATUSES.map(s => s.name);
}

export function getLastRunStatus(): {
  lastRunAt: string | null;
  lastSuccessfulRunAt: string | null;
  lastResult: IngestionReport | null;
  lastError: string | null;
  running: boolean;
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
    todayFetched: _todayStats.date === today ? _todayStats.fetched : 0,
    todayInserted: _todayStats.date === today ? _todayStats.inserted : 0,
  };
}

function canonicalCity(name: string): string {
  return name.toLowerCase().trim();
}

async function getActiveCities(): Promise<string[]> {
  const seen = new Map<string, string>();
  for (const c of GERMAN_CITIES) {
    seen.set(canonicalCity(c), c);
  }

  try {
    let profileCities: string[] = [];

    const { data: dataFull, error: errorFull } = await supabase
      .from("search_profiles")
      .select("city, city_name");

    if (!errorFull && dataFull) {
      for (const row of dataFull as Array<{ city?: string; city_name?: string }>) {
        const c = (row.city_name || row.city || "").trim();
        if (c) profileCities.push(c);
      }
    } else {
      log(`[ingest] search_profiles query error (city_name may not exist): ${errorFull?.message ?? "no data"}`, "ingest");

      const { data: dataBasic, error: errorBasic } = await supabase
        .from("search_profiles")
        .select("city");

      if (!errorBasic && dataBasic) {
        for (const row of dataBasic as Array<{ city?: string }>) {
          const c = (row.city || "").trim();
          if (c) profileCities.push(c);
        }
      } else {
        log(`[ingest] search_profiles fallback query also failed: ${errorBasic?.message ?? "no data"}`, "ingest");
      }
    }

    for (const c of profileCities) {
      const key = canonicalCity(c);
      if (!seen.has(key)) {
        seen.set(key, c);
      }
    }
  } catch (err: any) {
    log(`[ingest] getActiveCities exception: ${err.message} — using GERMAN_CITIES only`, "ingest");
  }

  const result = Array.from(seen.values());
  const profileExtra = result.length - GERMAN_CITIES.length;
  log(`[ingest] Active cities: ${result.length} (${GERMAN_CITIES.length} base + ${profileExtra} from profiles)`, "ingest");
  return result;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  log(`[INGEST START] Germany-wide ingestion`, "ingest");

  const fetchRunId = await createFetchRun();

  const sources: SourceReport[] = [];
  const cityReports: CityReport[] = [];
  const total = { found: 0, inserted: 0, duplicates: 0, matches: 0, errors: 0 };

  try {
    const cities = await getActiveCities();
    log(`[ingest] Active cities (${cities.length}): ${cities.join(", ")}`, "ingest");

    if (cities.length === 0) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      log(`[INGEST COMPLETE] in ${duration}s — no cities to process`, "ingest");
      const report: IngestionReport = { sources, cityReports, total, cities, durationSec: parseFloat(duration) };
      _lastResult = report;
      _lastRunAt = new Date().toISOString();
      return report;
    }

    for (let i = 0; i < cities.length; i++) {
      const city = cities[i];
      log(`[ingest] --- [${i + 1}/${cities.length}] Ingesting for city: ${city} ---`, "ingest");

      const cityTotal = { found: 0, inserted: 0, duplicates: 0, matches: 0, errors: 0 };
      const cityIngesters = buildIngestersForCity(city);

      for (const ingester of cityIngesters) {
        try {
          log(`  Running ${ingester.name}...`, "ingest");
          const result = await ingester.run();

          const report: SourceReport = {
            name: `${ingester.name} (${city})`,
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

          cityTotal.found += result.found;
          cityTotal.inserted += result.inserted;
          cityTotal.duplicates += result.duplicates;
          cityTotal.matches += result.matches;
          cityTotal.errors += result.errors;
        } catch (err: any) {
          log(`  ${ingester.name} FAILED: ${err.message}`, "ingest");
          sources.push({
            name: `${ingester.name} (${city})`,
            found: 0,
            inserted: 0,
            duplicates: 0,
            matches: 0,
            errors: 1,
          });
          cityTotal.errors += 1;
        }
      }

      cityReports.push({ city, ...cityTotal });
      log(
        `[ingest] City ${city}: found=${cityTotal.found} ins=${cityTotal.inserted} dup=${cityTotal.duplicates} match=${cityTotal.matches} err=${cityTotal.errors}`,
        "ingest"
      );

      total.found += cityTotal.found;
      total.inserted += cityTotal.inserted;
      total.duplicates += cityTotal.duplicates;
      total.matches += cityTotal.matches;
      total.errors += cityTotal.errors;

      if (i < cities.length - 1) {
        log(`[ingest] Waiting ${INTER_CITY_DELAY_MS}ms before next city...`, "ingest");
        await delay(INTER_CITY_DELAY_MS);
      }
    }

    let emailsSent = 0;
    let pushesSent = 0;

    if (areAlertsEnabled()) {
      const bufSize = getBufferSize();
      if (bufSize.listings > 0) {
        log(`[ingest] Flushing match alert buffer: ${bufSize.users} users, ${bufSize.listings} listings`, "ingest");
        try {
          const alertResult = await flushMatchAlertBuffer(supabase);
          emailsSent = alertResult.sent;
          pushesSent = alertResult.pushesSent || 0;
          log(`[ingest] Alert emails sent: ${alertResult.sent} success, ${alertResult.failed} failed, ${pushesSent} pushes`, "ingest");
        } catch (alertErr: any) {
          log(`[ingest] Alert flush error: ${alertErr.message}`, "ingest");
        }
      } else {
        log(`[ingest] No match alerts to send this cycle`, "ingest");
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(
      `[INGEST COMPLETE] in ${duration}s — cities=${cities.length} found=${total.found} inserted=${total.inserted} dup=${total.duplicates} matches=${total.matches} errors=${total.errors}`,
      "ingest"
    );

    log(`[ingest] Per-city summary:`, "ingest");
    for (const cr of cityReports) {
      log(`  ${cr.city.padEnd(15)} found=${String(cr.found).padStart(4)} ins=${String(cr.inserted).padStart(4)} dup=${String(cr.duplicates).padStart(4)} err=${String(cr.errors).padStart(2)}`, "ingest");
    }

    updateTodayStats(total.found, total.inserted);

    if (fetchRunId) {
      completeFetchRun(fetchRunId, {
        fetched_count: total.found,
        deduplicated_count: total.duplicates,
        newly_matched_count: total.matches,
        emails_sent_count: emailsSent,
        pushes_sent_count: pushesSent,
        error_count: total.errors,
        cities_processed: cities.length,
      }).catch(() => {});
    }

    const report: IngestionReport = { sources, cityReports, total, cities, durationSec: parseFloat(duration) };
    _lastResult = report;
    _lastRunAt = new Date().toISOString();
    if (total.errors === 0 || total.inserted > 0) {
      _lastSuccessfulRunAt = _lastRunAt;
    }
    return report;
  } catch (err: any) {
    _lastError = err.message;
    if (fetchRunId) failFetchRun(fetchRunId, err.message).catch(() => {});
    clearBuffer();
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
