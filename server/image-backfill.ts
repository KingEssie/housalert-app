import { log } from "./log";
import { pool } from "./pg-pool";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const PLACEHOLDER_PATTERNS = /placeholder|default|noimage|no-image|blank|spacer|1x1|pixel\.gif|static\/img\/no_pic/i;

function isPlaceholderOrMissing(url: string | null | undefined): boolean {
  if (!url || url.trim() === "") return true;
  if (PLACEHOLDER_PATTERNS.test(url)) return true;
  return false;
}

interface SourceHandler {
  name: string;
  fetchImage: (listingUrl: string) => Promise<{ url: string; method: string } | null>;
}

const sourceHandlers: Record<string, () => Promise<SourceHandler>> = {
  "wg-gesucht": async () => {
    const { fetchWgGesuchtImage } = await import("./ingesters/wg-gesucht");
    return { name: "wg-gesucht", fetchImage: fetchWgGesuchtImage };
  },
  "rentola": async () => {
    const { fetchRentolaImage } = await import("./ingesters/rentola-image");
    return { name: "rentola", fetchImage: fetchRentolaImage };
  },
};

export interface BackfillRunResult {
  source: string;
  started_at: string;
  finished_at: string;
  duration_sec: number;
  processed_count: number;
  updated_count: number;
  failed_count: number;
  skipped_count: number;
  methods: Record<string, number>;
  status: "success" | "partial" | "failed";
}

let _running = false;
let _enabled = true;
let _batchSize = 100;
let _enabledSources: string[] = ["wg-gesucht", "rentola"];
let _lastRun: BackfillRunResult | null = null;
let _cumulativeUpdates = 0;

export function isBackfillRunning() { return _running; }
export function isBackfillEnabled() { return _enabled; }
export function setBackfillEnabled(enabled: boolean) { _enabled = enabled; }
export function getBackfillBatchSize() { return _batchSize; }
export function setBackfillBatchSize(size: number) { _batchSize = Math.max(10, Math.min(size, 500)); }
export function getEnabledSources() { return _enabledSources; }
export function setEnabledSources(sources: string[]) { _enabledSources = sources.filter(s => s in sourceHandlers); }
export function getLastRun() { return _lastRun; }
export function getCumulativeUpdates() { return _cumulativeUpdates; }

export async function ensureBackfillRunsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS image_backfill_runs (
        id SERIAL PRIMARY KEY,
        source TEXT NOT NULL,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMPTZ,
        duration_sec REAL,
        processed_count INT DEFAULT 0,
        updated_count INT DEFAULT 0,
        failed_count INT DEFAULT 0,
        skipped_count INT DEFAULT 0,
        methods JSONB DEFAULT '{}',
        status TEXT DEFAULT 'running'
      )
    `);
  } catch (err: any) {
    log(`[IMAGE-BACKFILL] Table creation error: ${err.message}`);
  }
}

async function persistRun(result: BackfillRunResult) {
  try {
    await pool.query(
      `INSERT INTO image_backfill_runs (source, started_at, finished_at, duration_sec, processed_count, updated_count, failed_count, skipped_count, methods, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        result.source,
        result.started_at,
        result.finished_at,
        result.duration_sec,
        result.processed_count,
        result.updated_count,
        result.failed_count,
        result.skipped_count,
        JSON.stringify(result.methods),
        result.status,
      ]
    );
  } catch (err: any) {
    log(`[IMAGE-BACKFILL] Failed to persist run: ${err.message}`);
  }
}

async function runBackfillForSource(sourceName: string): Promise<BackfillRunResult> {
  const startedAt = new Date();
  const result: BackfillRunResult = {
    source: sourceName,
    started_at: startedAt.toISOString(),
    finished_at: "",
    duration_sec: 0,
    processed_count: 0,
    updated_count: 0,
    failed_count: 0,
    skipped_count: 0,
    methods: {},
    status: "success",
  };

  try {
    const handlerFactory = sourceHandlers[sourceName];
    if (!handlerFactory) {
      result.status = "failed";
      result.finished_at = new Date().toISOString();
      return result;
    }

    const handler = await handlerFactory();

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: listings, error } = await supabase
      .from("listings")
      .select("id, source_id, url, title, image_url")
      .eq("source", sourceName)
      .or("image_url.is.null,image_url.eq.")
      .order("created_at", { ascending: false })
      .limit(_batchSize);

    if (error) {
      log(`[IMAGE-BACKFILL] ${sourceName} query error: ${error.message}`);
      result.status = "failed";
      result.finished_at = new Date().toISOString();
      return result;
    }

    const eligible = (listings || []).filter(l => isPlaceholderOrMissing(l.image_url));
    result.skipped_count = (listings || []).length - eligible.length;

    log(`[IMAGE-BACKFILL] ${sourceName}: ${eligible.length} eligible listings (${result.skipped_count} skipped)`);

    for (const listing of eligible) {
      result.processed_count++;
      try {
        await new Promise(r => setTimeout(r, 1200));
        const imgResult = await handler.fetchImage(listing.url);
        if (imgResult) {
          const { error: updateErr } = await supabase
            .from("listings")
            .update({ image_url: imgResult.url })
            .eq("id", listing.id);
          if (!updateErr) {
            result.updated_count++;
            result.methods[imgResult.method] = (result.methods[imgResult.method] || 0) + 1;
          } else {
            result.failed_count++;
          }
        } else {
          result.failed_count++;
        }
      } catch {
        result.failed_count++;
      }
    }

    if (result.failed_count > 0 && result.updated_count > 0) {
      result.status = "partial";
    } else if (result.updated_count === 0 && result.processed_count > 0) {
      result.status = "failed";
    }
  } catch (err: any) {
    log(`[IMAGE-BACKFILL] ${sourceName} run error: ${err.message}`);
    result.status = "failed";
  }

  const finishedAt = new Date();
  result.finished_at = finishedAt.toISOString();
  result.duration_sec = Math.round((finishedAt.getTime() - startedAt.getTime()) / 100) / 10;

  return result;
}

export async function runImageBackfill(): Promise<BackfillRunResult[]> {
  if (_running) {
    log("[IMAGE-BACKFILL] Skipping — previous run still in progress");
    return [];
  }
  if (!_enabled) {
    return [];
  }
  if (_enabledSources.length === 0) {
    return [];
  }

  _running = true;
  const results: BackfillRunResult[] = [];

  try {
    for (const source of _enabledSources) {
      const result = await runBackfillForSource(source);
      results.push(result);
      _cumulativeUpdates += result.updated_count;
      _lastRun = result;
      await persistRun(result);

      log(`[IMAGE-BACKFILL] ${source}: processed=${result.processed_count} updated=${result.updated_count} failed=${result.failed_count} status=${result.status} (${result.duration_sec}s)`);
    }
  } finally {
    _running = false;
  }

  return results;
}

export async function getRecentRuns(limit = 20): Promise<any[]> {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM image_backfill_runs ORDER BY started_at DESC LIMIT $1",
      [limit]
    );
    return rows;
  } catch {
    return [];
  }
}

export async function getBackfillStats(): Promise<{ totalRuns: number; totalUpdated: number; totalProcessed: number }> {
  try {
    const { rows } = await pool.query(
      "SELECT COUNT(*)::int AS total_runs, COALESCE(SUM(updated_count), 0)::int AS total_updated, COALESCE(SUM(processed_count), 0)::int AS total_processed FROM image_backfill_runs"
    );
    return {
      totalRuns: rows[0]?.total_runs || 0,
      totalUpdated: rows[0]?.total_updated || 0,
      totalProcessed: rows[0]?.total_processed || 0,
    };
  } catch {
    return { totalRuns: 0, totalUpdated: 0, totalProcessed: 0 };
  }
}
