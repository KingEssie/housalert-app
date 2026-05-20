import { log } from "../log";
import { createClient } from "@supabase/supabase-js";
import { createKleinanzeigenIngester } from "./kleinanzeigen";
import { createWgGesuchtIngester } from "./wg-gesucht";
import { createVonoviaIngester } from "./vonovia";
import { createWohnungsboerseIngester } from "./wohnungsboerse";
import { flushMatchAlertBuffer, getBufferSize } from "../notifications/buffer";
import { areAlertsEnabled } from "../notifications";
import { getFastLanePairs } from "./source-capabilities";
import { recordSlaEvent } from "../monitoring/sla-metrics";
import type { IngestionResult } from "./types";

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export interface FastLaneRunResult {
  source: string;
  city: string;
  found: number;
  inserted: number;
  duplicates: number;
  matches: number;
  durationMs: number;
  runAt: string;
  circuitOpen: boolean;
  error?: string;
}

interface CircuitState {
  failures: number;
  openUntil: number | null;
}

const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_OPEN_MS = 5 * 60 * 1000;
const _circuits = new Map<string, CircuitState>();

function getCircuit(key: string): CircuitState {
  if (!_circuits.has(key)) _circuits.set(key, { failures: 0, openUntil: null });
  return _circuits.get(key)!;
}

function isCircuitOpen(key: string): boolean {
  const c = getCircuit(key);
  if (c.openUntil === null) return false;
  if (Date.now() > c.openUntil) {
    c.openUntil = null;
    c.failures = 0;
    return false;
  }
  return true;
}

function recordFailure(key: string): void {
  const c = getCircuit(key);
  c.failures++;
  if (c.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    c.openUntil = Date.now() + CIRCUIT_OPEN_MS;
    log(`[FAST-LANE] Circuit OPEN for ${key} — pausing ${CIRCUIT_OPEN_MS / 1000}s`, "fast-lane");
  }
}

function recordSuccess(key: string): void {
  const c = _circuits.get(key);
  if (c) { c.failures = 0; c.openUntil = null; }
}

const MAX_HISTORY = 30;
const _history = new Map<string, FastLaneRunResult[]>();
let _lastFastLaneAt: string | null = null;
let _fastLaneRunning = false;

export function getFastLaneStatus(): {
  pairs: Array<{ source: string; city: string; lastRun: FastLaneRunResult | null; circuitOpen: boolean }>;
  lastFastLaneAt: string | null;
  isRunning: boolean;
} {
  const pairs = getFastLanePairs().map(({ source, city }) => {
    const key = `${source}:${city}`;
    const hist = _history.get(key) ?? [];
    return { source, city, lastRun: hist[hist.length - 1] ?? null, circuitOpen: isCircuitOpen(key) };
  });
  return { pairs, lastFastLaneAt: _lastFastLaneAt, isRunning: _fastLaneRunning };
}

export function getFastLaneHistory(source: string, city: string): FastLaneRunResult[] {
  return [...(_history.get(`${source}:${city}`) ?? [])].reverse();
}

function createFastLaneIngester(source: string, city: string) {
  switch (source) {
    case "kleinanzeigen":  return createKleinanzeigenIngester(city, { maxPages: 1 });
    case "wg-gesucht":     return createWgGesuchtIngester(city, { maxPages: 1 });
    case "vonovia":        return createVonoviaIngester(city, { maxPages: 1 });
    case "wohnungsboerse": return createWohnungsboerseIngester(city, { maxPages: 1 });
    default:               return null;
  }
}

async function runOnePair(source: string, city: string): Promise<FastLaneRunResult> {
  const key = `${source}:${city}`;
  const runAt = new Date().toISOString();
  const start = Date.now();

  if (isCircuitOpen(key)) {
    log(`[FAST-LANE] ${key} circuit is open — skipping`, "fast-lane");
    return { source, city, found: 0, inserted: 0, duplicates: 0, matches: 0, durationMs: 0, runAt, circuitOpen: true };
  }

  const ingester = createFastLaneIngester(source, city);
  if (!ingester) {
    return { source, city, found: 0, inserted: 0, duplicates: 0, matches: 0, durationMs: 0, runAt, circuitOpen: false, error: "No ingester for source" };
  }

  try {
    const result: IngestionResult = await ingester.run();
    const durationMs = Date.now() - start;
    recordSuccess(key);

    if (result.inserted > 0) {
      recordSlaEvent({
        listingId: `batch:${source}:${city}:${runAt}`,
        source,
        city,
        sourcePublishedAt: null,
        firstSeenAt: runAt,
        matchedAt: new Date().toISOString(),
        notificationSentAt: null,
        isFastLane: true,
      });
    }

    const runResult: FastLaneRunResult = {
      source, city,
      found: result.found, inserted: result.inserted, duplicates: result.duplicates, matches: result.matches,
      durationMs, runAt, circuitOpen: false,
    };
    _pushHistory(key, runResult);
    log(`[FAST-LANE] ${key} found=${result.found} ins=${result.inserted} [${durationMs}ms]`, "fast-lane");
    return runResult;
  } catch (err: any) {
    const durationMs = Date.now() - start;
    recordFailure(key);
    log(`[FAST-LANE] ${key} ERROR: ${err.message} [${durationMs}ms]`, "fast-lane");
    const runResult: FastLaneRunResult = {
      source, city, found: 0, inserted: 0, duplicates: 0, matches: 0,
      durationMs, runAt, circuitOpen: false, error: err.message,
    };
    _pushHistory(key, runResult);
    return runResult;
  }
}

function _pushHistory(key: string, result: FastLaneRunResult): void {
  const hist = _history.get(key) ?? [];
  hist.push(result);
  if (hist.length > MAX_HISTORY) hist.shift();
  _history.set(key, hist);
}

const MAX_PARALLEL = 4;

export async function runFastLane(): Promise<FastLaneRunResult[]> {
  if (_fastLaneRunning) {
    log("[FAST-LANE] Still running from previous tick — skipping", "fast-lane");
    return [];
  }

  _fastLaneRunning = true;
  const startMs = Date.now();
  const pairs = getFastLanePairs();
  const allResults: FastLaneRunResult[] = [];

  try {
    for (let i = 0; i < pairs.length; i += MAX_PARALLEL) {
      const batch = pairs.slice(i, i + MAX_PARALLEL);
      const results = await Promise.all(batch.map(({ source, city }) => runOnePair(source, city)));
      allResults.push(...results);
    }

    const totalInserted = allResults.reduce((s, r) => s + r.inserted, 0);

    if (totalInserted > 0 && areAlertsEnabled()) {
      const bufSize = getBufferSize();
      if (bufSize.listings > 0) {
        log(`[FAST-LANE] Flushing ${bufSize.listings} new matches for ${bufSize.users} users`, "fast-lane");
        try {
          const flush = await flushMatchAlertBuffer(supabase) as any;
          log(`[FAST-LANE] Flush done: emails=${flush.sent} pushes=${flush.pushesSent ?? 0}`, "fast-lane");
        } catch (err: any) {
          log(`[FAST-LANE] Flush error: ${err.message}`, "fast-lane");
        }
      }
    }

    _lastFastLaneAt = new Date().toISOString();
    const totalMs = Date.now() - startMs;
    const skipped = allResults.filter(r => r.circuitOpen).length;
    const withErrors = allResults.filter(r => r.error && !r.circuitOpen).length;
    log(
      `[FAST-LANE] Cycle done in ${totalMs}ms | found=${allResults.reduce((s, r) => s + r.found, 0)} ` +
      `inserted=${totalInserted} circuitOpen=${skipped} errors=${withErrors}`,
      "fast-lane"
    );
  } finally {
    _fastLaneRunning = false;
  }

  return allResults;
}
