import { log } from "../log";
import { createClient } from "@supabase/supabase-js";
import { fetchKleinanzeigenListings } from "./kleinanzeigen";
import { fetchAndParseListings as fetchWgGesuchtListings } from "./wg-gesucht";
import { fetchAllListings as fetchVonoviaListings } from "./vonovia";
import { fetchWohnungsboerseListings } from "./wohnungsboerse";
import { insertAndMatchListings, type ParsedListing } from "./matching";
import { flushMatchAlertBuffer, getBufferSize } from "../notifications/buffer";
import { areAlertsEnabled } from "../notifications";
import { getFastLanePairs, getSourceCapability } from "./source-capabilities";
import { recordSlaEvent, updateInsertedAt, updateMatchedAt as slaUpdateMatchedAt } from "../monitoring/sla-metrics";

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
  earlyExit?: boolean;
  knownSkipped?: number;
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

function recordCircuitFailure(key: string): void {
  const c = getCircuit(key);
  c.failures++;
  if (c.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    c.openUntil = Date.now() + CIRCUIT_OPEN_MS;
    log(`[FAST-LANE] Circuit OPEN for ${key} — pausing ${CIRCUIT_OPEN_MS / 1000}s`, "fast-lane");
  }
}

function recordCircuitSuccess(key: string): void {
  const c = _circuits.get(key);
  if (c) { c.failures = 0; c.openUntil = null; }
}

const MAX_HISTORY = 30;
const _history = new Map<string, FastLaneRunResult[]>();
const _pairRunning = new Map<string, boolean>();
const _pairLastRunAt = new Map<string, string>();

let _lastFastLaneAt: string | null = null;

export function getFastLaneStatus(): {
  pairs: Array<{ source: string; city: string; intervalSeconds: number; lastRun: FastLaneRunResult | null; circuitOpen: boolean; lastRunAt: string | null }>;
  lastFastLaneAt: string | null;
  isRunning: boolean;
} {
  const pairs = getFastLanePairs().map(({ source, city, intervalSeconds }) => {
    const key = `${source}:${city}`;
    const hist = _history.get(key) ?? [];
    return {
      source, city, intervalSeconds,
      lastRun: hist[hist.length - 1] ?? null,
      circuitOpen: isCircuitOpen(key),
      lastRunAt: _pairLastRunAt.get(key) ?? null,
    };
  });
  const anyRunning = Array.from(_pairRunning.values()).some(Boolean);
  return { pairs, lastFastLaneAt: _lastFastLaneAt, isRunning: anyRunning };
}

export function getFastLaneHistory(source: string, city: string): FastLaneRunResult[] {
  return [...(_history.get(`${source}:${city}`) ?? [])].reverse();
}

export function getFastLaneStalenessMs(): number | null {
  if (!_lastFastLaneAt) return null;
  return Date.now() - new Date(_lastFastLaneAt).getTime();
}

function pushHistory(key: string, result: FastLaneRunResult): void {
  const hist = _history.get(key) ?? [];
  hist.push(result);
  if (hist.length > MAX_HISTORY) hist.shift();
  _history.set(key, hist);
}

/** Fetch the most recent source_ids known to the DB for a given source+city. */
async function fetchKnownSourceIds(source: string, city: string, limit = 80): Promise<Set<string>> {
  try {
    const { data } = await supabase
      .from("listings")
      .select("source_id")
      .eq("source", source)
      .eq("city", city)
      .not("source_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!data || data.length === 0) return new Set();
    return new Set(data.map((r: any) => r.source_id).filter(Boolean));
  } catch {
    return new Set();
  }
}

/** Fetch page 1 listings for a given source. Returns parsed listings. */
async function fetchPage1(source: string, city: string): Promise<{
  listings: ParsedListing[];
  botBlocked: boolean;
}> {
  switch (source) {
    case "kleinanzeigen": {
      const r = await fetchKleinanzeigenListings(city, { maxPages: 1 });
      return { listings: r.listings, botBlocked: r.botBlocked };
    }
    case "wg-gesucht": {
      const listings = await fetchWgGesuchtListings(city, { maxPages: 1 });
      return { listings, botBlocked: false };
    }
    case "vonovia": {
      const r = await fetchVonoviaListings(city, { maxPages: 1 });
      return { listings: r.listings, botBlocked: false };
    }
    case "wohnungsboerse": {
      const r = await fetchWohnungsboerseListings(city, { maxPages: 1 });
      return { listings: r.listings, botBlocked: r.botBlocked };
    }
    default:
      throw new Error(`No fast-lane fetcher for source: ${source}`);
  }
}

/**
 * For sources that sort newest-first (KA), stop at the first known ID —
 * everything after it is older and already seen.
 * For other sources, filter all known IDs.
 */
function filterNewListings(
  source: string,
  listings: ParsedListing[],
  knownIds: Set<string>
): { newListings: ParsedListing[]; knownSkipped: number; earlyExit: boolean } {
  if (knownIds.size === 0) return { newListings: listings, knownSkipped: 0, earlyExit: false };

  if (source === "kleinanzeigen") {
    const stopIdx = listings.findIndex(l => l.source_id && knownIds.has(l.source_id));
    if (stopIdx === 0) {
      return { newListings: [], knownSkipped: listings.length, earlyExit: true };
    }
    if (stopIdx > 0) {
      return {
        newListings: listings.slice(0, stopIdx),
        knownSkipped: listings.length - stopIdx,
        earlyExit: true,
      };
    }
    return { newListings: listings, knownSkipped: 0, earlyExit: false };
  }

  const newListings = listings.filter(l => !l.source_id || !knownIds.has(l.source_id));
  return {
    newListings,
    knownSkipped: listings.length - newListings.length,
    earlyExit: newListings.length === 0 && listings.length > 0,
  };
}

async function runOnePair(source: string, city: string): Promise<FastLaneRunResult> {
  const key = `${source}:${city}`;
  const runAt = new Date().toISOString();
  const start = Date.now();

  if (isCircuitOpen(key)) {
    log(`[FAST-LANE] ${key} circuit open — skipping`, "fast-lane");
    return { source, city, found: 0, inserted: 0, duplicates: 0, matches: 0, durationMs: 0, runAt, circuitOpen: true };
  }

  try {
    const firstSeenAt = new Date().toISOString();
    const [{ listings, botBlocked }, knownIds] = await Promise.all([
      fetchPage1(source, city),
      fetchKnownSourceIds(source, city),
    ]);

    if (botBlocked) {
      recordCircuitFailure(key);
      const durationMs = Date.now() - start;
      const result: FastLaneRunResult = { source, city, found: 0, inserted: 0, duplicates: 0, matches: 0, durationMs, runAt, circuitOpen: false, error: "bot-blocked" };
      pushHistory(key, result);
      log(`[FAST-LANE] ${key} bot-blocked [${durationMs}ms]`, "fast-lane");
      return result;
    }

    const { newListings, knownSkipped, earlyExit } = filterNewListings(source, listings, knownIds);

    if (earlyExit || newListings.length === 0) {
      recordCircuitSuccess(key);
      const durationMs = Date.now() - start;
      const result: FastLaneRunResult = {
        source, city,
        found: listings.length, inserted: 0, duplicates: knownSkipped,
        matches: 0, durationMs, runAt, circuitOpen: false, earlyExit, knownSkipped,
      };
      pushHistory(key, result);
      log(`[FAST-LANE] ${key} found=${listings.length} early-exit=${earlyExit} knownSkipped=${knownSkipped} [${durationMs}ms]`, "fast-lane");
      return result;
    }

    const insertResult = await insertAndMatchListings(newListings);
    recordCircuitSuccess(key);

    if (insertResult.inserted > 0) {
      for (const listing of newListings) {
        if (listing.source_id && !knownIds.has(listing.source_id)) {
          recordSlaEvent({
            listingId: listing.source_id,
            source,
            city,
            sourcePublishedAt: listing.source_published_at ?? null,
            firstSeenAt,
            isFastLane: true,
          });
        }
      }
    }

    const durationMs = Date.now() - start;
    const result: FastLaneRunResult = {
      source, city,
      found: listings.length,
      inserted: insertResult.inserted,
      duplicates: insertResult.duplicates + knownSkipped,
      matches: insertResult.matches,
      durationMs, runAt, circuitOpen: false,
      knownSkipped,
    };
    pushHistory(key, result);
    log(`[FAST-LANE] ${key} found=${listings.length} new=${newListings.length} ins=${insertResult.inserted} knownSkipped=${knownSkipped} [${durationMs}ms]`, "fast-lane");
    return result;

  } catch (err: any) {
    const durationMs = Date.now() - start;
    recordCircuitFailure(key);
    log(`[FAST-LANE] ${key} ERROR: ${err.message} [${durationMs}ms]`, "fast-lane");
    const result: FastLaneRunResult = {
      source, city, found: 0, inserted: 0, duplicates: 0, matches: 0,
      durationMs, runAt, circuitOpen: false, error: err.message,
    };
    pushHistory(key, result);
    return result;
  }
}

async function runOnePairWithFlush(source: string, city: string): Promise<void> {
  const key = `${source}:${city}`;
  if (_pairRunning.get(key)) {
    log(`[FAST-LANE] ${key} still running — skipping tick`, "fast-lane");
    return;
  }

  _pairRunning.set(key, true);
  try {
    const result = await runOnePair(source, city);
    _pairLastRunAt.set(key, new Date().toISOString());
    _lastFastLaneAt = new Date().toISOString();

    if (result.inserted > 0 && areAlertsEnabled()) {
      const bufSize = getBufferSize();
      if (bufSize.listings > 0) {
        log(`[FAST-LANE] ${key} inserted ${result.inserted} — flushing ${bufSize.listings} matches for ${bufSize.users} users`, "fast-lane");
        try {
          const flush = await flushMatchAlertBuffer(supabase) as any;
          log(`[FAST-LANE] ${key} flush done: emails=${flush.sent} pushes=${flush.pushesSent ?? 0}`, "fast-lane");
        } catch (err: any) {
          log(`[FAST-LANE] ${key} flush error: ${err.message}`, "fast-lane");
        }
      }
    }
  } finally {
    _pairRunning.set(key, false);
  }
}

/** Start independent per-source-pair timers (KA/WG: 15s, Vonovia/WB: 30s). */
export function startPerSourceTimers(): void {
  const pairs = getFastLanePairs();
  let staggerMs = 0;

  for (const { source, city, intervalSeconds } of pairs) {
    const key = `${source}:${city}`;
    const intervalMs = intervalSeconds * 1000;

    const doRun = () => runOnePairWithFlush(source, city).catch(e => {
      log(`[FAST-LANE] ${key} uncaught: ${e.message}`, "fast-lane");
    });

    setTimeout(() => {
      doRun();
      setInterval(doRun, intervalMs);
    }, staggerMs);

    staggerMs += 5_000;
    log(`[FAST-LANE] ${key} scheduled every ${intervalSeconds}s (starts in ${staggerMs / 1000}s)`, "fast-lane");
  }
}

/** Legacy: run all pairs once (used during recovery / one-off triggers). */
export async function runFastLane(): Promise<FastLaneRunResult[]> {
  const pairs = getFastLanePairs();
  const results: FastLaneRunResult[] = [];

  for (let i = 0; i < pairs.length; i += 2) {
    const batch = pairs.slice(i, i + 2);
    const batchResults = await Promise.all(
      batch.map(({ source, city }) => runOnePair(source, city))
    );
    results.push(...batchResults);
  }

  const totalInserted = results.reduce((s, r) => s + r.inserted, 0);
  if (totalInserted > 0 && areAlertsEnabled()) {
    const bufSize = getBufferSize();
    if (bufSize.listings > 0) {
      try {
        await flushMatchAlertBuffer(supabase) as any;
      } catch (err: any) {
        log(`[FAST-LANE] flush error: ${err.message}`, "fast-lane");
      }
    }
  }
  _lastFastLaneAt = new Date().toISOString();
  return results;
}
