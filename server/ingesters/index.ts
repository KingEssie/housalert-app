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
import { flushMatchAlertBuffer, clearBuffer, getBufferSize, recoverUndeliveredMatches } from "../notifications/buffer";
import { createFetchRun, completeFetchRun, failFetchRun } from "../user-matches";
import { buildScrapeQueue, type TieredCity } from "./city-tiers";

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let _cycleNumber = -1;

const INTER_CITY_DELAY_T1_MS = 800;
const INTER_CITY_DELAY_OTHER_MS = 1200;

export interface SourceReport {
  name: string;
  found: number;
  inserted: number;
  duplicates: number;
  matches: number;
  errors: number;
  durationMs?: number;
}

export interface CityReport {
  city: string;
  tier?: number;
  found: number;
  inserted: number;
  duplicates: number;
  matches: number;
  errors: number;
  durationMs?: number;
  alertsFlushed?: boolean;
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
  flushesPerCity?: number;
}

let _running = false;
let _lastRunAt: string | null = null;
let _lastSuccessfulRunAt: string | null = null;
let _lastResult: IngestionReport | null = null;
let _lastError: string | null = null;
let _lastActivityAt: string | null = null;
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

export function getLastActivityAt(): string | null {
  return _lastActivityAt;
}

export interface SourceStatus {
  name: string;
  status: "active" | "broken" | "gone";
  note?: string;
}

const SOURCE_STATUSES: SourceStatus[] = [
  { name: "wg-gesucht", status: "active" },
  { name: "kleinanzeigen", status: "broken", note: "Returns 403 — bot-blocked" },
  { name: "immowelt", status: "active" },
  { name: "wohnungsboerse", status: "broken", note: "Returns 504 — gateway timeout" },
  { name: "immoscout", status: "broken", note: "Returns 401 — bot-blocked" },
  { name: "rentola", status: "broken", note: "Fetch timeout — server unresponsive" },
  { name: "nestpick", status: "broken", note: "Fetch timeout — server unresponsive" },
  { name: "immonet", status: "gone", note: "Returns 410 — service discontinued" },
];

export function getSourceStatuses(): SourceStatus[] {
  return SOURCE_STATUSES;
}

export function getEnabledSources(): string[] {
  return SOURCE_STATUSES.filter(s => s.status === "active").map(s => s.name);
}

let _disabledSourceOverrides: Set<string> = new Set();

export function setDisabledSourceOverrides(disabled: Set<string>) {
  _disabledSourceOverrides = disabled;
}

export function getDisabledSourceOverrides(): Set<string> {
  return _disabledSourceOverrides;
}

export function isSourceEnabledByAdmin(sourceName: string): boolean {
  return !_disabledSourceOverrides.has(sourceName);
}

export function getLastRunStatus(): {
  lastRunAt: string | null;
  lastSuccessfulRunAt: string | null;
  lastActivityAt: string | null;
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
    lastActivityAt: _lastActivityAt,
    lastResult: _lastResult,
    lastError: _lastError,
    running: _running,
    todayFetched: _todayStats.date === today ? _todayStats.fetched : 0,
    todayInserted: _todayStats.date === today ? _todayStats.inserted : 0,
  };
}

async function getUserProfileCities(): Promise<string[]> {
  try {
    const { data: dataFull, error: errorFull } = await supabase
      .from("search_profiles")
      .select("city, city_name");

    if (!errorFull && dataFull) {
      return (dataFull as Array<{ city?: string; city_name?: string }>)
        .map((row) => (row.city_name || row.city || "").trim())
        .filter(Boolean);
    }

    log(`[ingest] search_profiles query error (city_name may not exist): ${errorFull?.message ?? "no data"}`, "ingest");

    const { data: dataBasic, error: errorBasic } = await supabase
      .from("search_profiles")
      .select("city");

    if (!errorBasic && dataBasic) {
      return (dataBasic as Array<{ city?: string }>)
        .map((row) => (row.city || "").trim())
        .filter(Boolean);
    }

    log(`[ingest] search_profiles fallback query also failed: ${errorBasic?.message ?? "no data"}`, "ingest");
  } catch (err: any) {
    log(`[ingest] getUserProfileCities exception: ${err.message}`, "ingest");
  }
  return [];
}

async function getActiveCities(): Promise<TieredCity[]> {
  const userCities = await getUserProfileCities();
  return buildScrapeQueue(userCities, _cycleNumber);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SOURCE_PRIORITY: Record<string, number> = {
  "wg-gesucht": 1,
  "kleinanzeigen": 2,
  "immowelt": 3,
  "wohnungsboerse": 4,
  "rentola": 5,
  "nestpick": 6,
};

function getSourcePriority(name: string): number {
  for (const [key, prio] of Object.entries(SOURCE_PRIORITY)) {
    if (name.startsWith(key)) return prio;
  }
  return 99;
}


const SKIP_SOURCES = new Set(
  SOURCE_STATUSES.filter(s => s.status === "broken" || s.status === "gone").map(s => s.name)
);

function buildIngestersForCity(city: string): Ingester[] {
  const ingesters: Ingester[] = [];

  if (!SKIP_SOURCES.has("wg-gesucht") && isSourceEnabledByAdmin("wg-gesucht")) ingesters.push(createWgGesuchtIngester(city));
  if (!SKIP_SOURCES.has("kleinanzeigen") && isSourceEnabledByAdmin("kleinanzeigen")) ingesters.push(createKleinanzeigenIngester(city));
  if (!SKIP_SOURCES.has("immowelt") && isSourceEnabledByAdmin("immowelt")) ingesters.push(createImmoweltIngester(city));

  const slugs = getCitySlugs(city);
  const slug = slugs?.slug ?? makeFallbackSlug(city);
  const configSources = buildSourcesForCity(city, slug);
  for (const cfg of configSources) {
    if (SKIP_SOURCES.has(cfg.source)) continue;
    if (!isSourceEnabledByAdmin(cfg.source)) continue;
    ingesters.push(createConfigIngester(cfg));
  }

  ingesters.sort((a, b) => getSourcePriority(a.name) - getSourcePriority(b.name));

  return ingesters;
}

const MAX_PARALLEL_SOURCES = 3;

async function runSourcesForCity(
  city: string,
  cityIngesters: Ingester[]
): Promise<{ sources: SourceReport[]; cityTotal: { found: number; inserted: number; duplicates: number; matches: number; errors: number } }> {
  const sources: SourceReport[] = [];
  const cityTotal = { found: 0, inserted: 0, duplicates: 0, matches: 0, errors: 0 };

  const runIngester = async (ingester: Ingester): Promise<SourceReport> => {
    const srcStart = Date.now();
    try {
      log(`  Running ${ingester.name}...`, "ingest");
      const result = await ingester.run();
      const srcDuration = Date.now() - srcStart;

      const report: SourceReport = {
        name: `${ingester.name} (${city})`,
        found: result.found,
        inserted: result.inserted,
        duplicates: result.duplicates,
        matches: result.matches,
        errors: result.errors,
        durationMs: srcDuration,
      };

      log(
        `  ${ingester.name}: found=${result.found} ins=${result.inserted} dup=${result.duplicates} match=${result.matches} err=${result.errors} [${srcDuration}ms]`,
        "ingest"
      );

      return report;
    } catch (err: any) {
      const srcDuration = Date.now() - srcStart;
      log(`  ${ingester.name} FAILED: ${err.message} [${srcDuration}ms]`, "ingest");
      return {
        name: `${ingester.name} (${city})`,
        found: 0,
        inserted: 0,
        duplicates: 0,
        matches: 0,
        errors: 1,
        durationMs: srcDuration,
      };
    }
  };

  for (let i = 0; i < cityIngesters.length; i += MAX_PARALLEL_SOURCES) {
    const batch = cityIngesters.slice(i, i + MAX_PARALLEL_SOURCES);
    const results = await Promise.all(batch.map(runIngester));

    for (const report of results) {
      sources.push(report);
      cityTotal.found += report.found;
      cityTotal.inserted += report.inserted;
      cityTotal.duplicates += report.duplicates;
      cityTotal.matches += report.matches;
      cityTotal.errors += report.errors;
    }
  }

  return { sources, cityTotal };
}

export async function runAllIngesters(): Promise<IngestionReport> {
  if (_running) {
    throw new OverlapError("Ingest already running");
  }

  _running = true;
  _lastError = null;
  _lastActivityAt = new Date().toISOString();
  const startTime = Date.now();
  _cycleNumber++;
  log(`[INGEST START] Germany-wide ingestion (cycle #${_cycleNumber})`, "ingest");

  const fetchRunId = await createFetchRun();

  const sources: SourceReport[] = [];
  const cityReports: CityReport[] = [];
  const total = { found: 0, inserted: 0, duplicates: 0, matches: 0, errors: 0 };
  let flushesPerCity = 0;

  try {
    const tieredCities = await getActiveCities();
    const cityNames = tieredCities.map((tc) => tc.name);
    log(`[ingest] Active cities (${tieredCities.length}): ${tieredCities.map((tc) => `${tc.name}(T${tc.tier})`).join(", ")}`, "ingest");

    if (tieredCities.length === 0) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      log(`[INGEST COMPLETE] in ${duration}s — no cities to process`, "ingest");
      const report: IngestionReport = { sources, cityReports, total, cities: cityNames, durationSec: parseFloat(duration) };
      _lastResult = report;
      _lastRunAt = new Date().toISOString();
      return report;
    }

    for (let i = 0; i < tieredCities.length; i++) {
      const { name: city, tier } = tieredCities[i];
      const cityStart = Date.now();
      log(`[ingest] --- [${i + 1}/${tieredCities.length}] Ingesting for city: ${city} (Tier ${tier}) ---`, "ingest");

      const cityIngesters = buildIngestersForCity(city);
      const { sources: citySources, cityTotal } = await runSourcesForCity(city, cityIngesters);

      sources.push(...citySources);

      const cityDuration = Date.now() - cityStart;

      total.found += cityTotal.found;
      total.inserted += cityTotal.inserted;
      total.duplicates += cityTotal.duplicates;
      total.matches += cityTotal.matches;
      total.errors += cityTotal.errors;

      let alertsFlushed = false;
      if (areAlertsEnabled() && cityTotal.inserted > 0) {
        const bufSize = getBufferSize();
        if (bufSize.listings > 0) {
          const flushStart = Date.now();
          log(`[ingest] [PER-CITY FLUSH] ${city}: flushing ${bufSize.listings} matches for ${bufSize.users} users`, "ingest");
          try {
            const alertResult = await flushMatchAlertBuffer(supabase);
            const flushDuration = Date.now() - flushStart;
            log(
              `[ingest] [PER-CITY FLUSH] ${city}: sent=${alertResult.sent} failed=${alertResult.failed} pushes=${alertResult.pushesSent || 0} [${flushDuration}ms]`,
              "ingest"
            );
            alertsFlushed = true;
            flushesPerCity++;
          } catch (alertErr: any) {
            log(`[ingest] [PER-CITY FLUSH] ${city}: error — ${alertErr.message}`, "ingest");
          }
        }
      }

      cityReports.push({ city, tier, ...cityTotal, durationMs: cityDuration, alertsFlushed });
      _lastActivityAt = new Date().toISOString();
      log(
        `[ingest] City ${city} (T${tier}): found=${cityTotal.found} ins=${cityTotal.inserted} dup=${cityTotal.duplicates} match=${cityTotal.matches} err=${cityTotal.errors} [${cityDuration}ms]`,
        "ingest"
      );

      if (i < tieredCities.length - 1) {
        const interDelay = tier === 1 ? INTER_CITY_DELAY_T1_MS : INTER_CITY_DELAY_OTHER_MS;
        await delay(interDelay);
      }
    }

    let emailsSent = 0;
    let pushesSent = 0;

    if (areAlertsEnabled()) {
      const bufSize = getBufferSize();
      if (bufSize.listings > 0) {
        log(`[ingest] [FINAL FLUSH] Remaining buffer: ${bufSize.users} users, ${bufSize.listings} listings`, "ingest");
        try {
          const alertResult = await flushMatchAlertBuffer(supabase);
          emailsSent = alertResult.sent;
          pushesSent = alertResult.pushesSent || 0;
          log(`[ingest] [FINAL FLUSH] sent=${alertResult.sent} failed=${alertResult.failed} pushes=${pushesSent}`, "ingest");
        } catch (alertErr: any) {
          log(`[ingest] [FINAL FLUSH] error: ${alertErr.message}`, "ingest");
        }
      }

      // Recovery runs independently via scheduler every 5 min — skip here to avoid concurrent flush
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(
      `[INGEST COMPLETE] in ${duration}s — cities=${tieredCities.length} found=${total.found} inserted=${total.inserted} dup=${total.duplicates} matches=${total.matches} errors=${total.errors} flushes=${flushesPerCity}`,
      "ingest"
    );

    log(`[ingest] Per-city breakdown:`, "ingest");
    for (const cr of cityReports) {
      const tierTag = cr.tier ? `T${cr.tier}` : "T?";
      const durationTag = cr.durationMs ? `${cr.durationMs}ms` : "?ms";
      const flushTag = cr.alertsFlushed ? " [FLUSHED]" : "";
      log(`  ${cr.city.padEnd(15)} (${tierTag}) found=${String(cr.found).padStart(4)} ins=${String(cr.inserted).padStart(4)} dup=${String(cr.duplicates).padStart(4)} err=${String(cr.errors).padStart(2)} [${durationTag}]${flushTag}`, "ingest");
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
        cities_processed: tieredCities.length,
      }).catch(() => {});
    }

    const report: IngestionReport = { sources, cityReports, total, cities: cityNames, durationSec: parseFloat(duration), flushesPerCity };
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
