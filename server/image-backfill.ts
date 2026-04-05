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

interface ListingMeta {
  url: string;
  source_id?: string;
  title?: string;
  city?: string;
}

interface SourceHandler {
  name: string;
  fetchImage: (listingUrl: string, meta?: ListingMeta) => Promise<{ url: string; method: string } | null>;
}

const SOURCE_PRIORITY: string[] = ["wg-gesucht", "rentola", "nestpick"];

const SOURCE_RETRY_LIMITS: Record<string, number> = {
  "wg-gesucht": 10,
  "rentola": 5,
  "nestpick": 3,
};

const RETRY_COOLDOWN_HOURS: Record<string, number> = {
  "wg-gesucht": 6,
  "rentola": 12,
  "nestpick": 24,
};

const sourceHandlers: Record<string, () => Promise<SourceHandler>> = {
  "wg-gesucht": async () => {
    const { fetchWgGesuchtImage } = await import("./ingesters/wg-gesucht");
    return { name: "wg-gesucht", fetchImage: fetchWgGesuchtImage };
  },
  "rentola": async () => {
    const { fetchRentolaImage } = await import("./ingesters/rentola-image");
    return { name: "rentola", fetchImage: fetchRentolaImage };
  },
  "nestpick": async () => {
    const { fetchNestpickImage, clearSearchCache } = await import("./ingesters/nestpick-image");
    clearSearchCache();
    return {
      name: "nestpick",
      fetchImage: (url: string, meta?: ListingMeta) =>
        fetchNestpickImage(url, { city: meta?.city, sourceId: meta?.source_id, title: meta?.title }),
    };
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
let _enabledSources: string[] = ["wg-gesucht", "rentola", "nestpick"];
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
export function getSourceRetryLimits() { return { ...SOURCE_RETRY_LIMITS }; }
export function getSourceCooldownHours() { return { ...RETRY_COOLDOWN_HOURS }; }

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

export async function ensureTrackingTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS image_backfill_tracking (
        listing_id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        retry_count INT DEFAULT 0,
        last_retry_at TIMESTAMPTZ,
        recovery_status TEXT DEFAULT 'pending',
        recovered_at TIMESTAMPTZ,
        recovered_method TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ibt_source ON image_backfill_tracking(source)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ibt_status ON image_backfill_tracking(recovery_status)`);
  } catch (err: any) {
    log(`[IMAGE-BACKFILL] Tracking table creation error: ${err.message}`);
  }
}

async function getTrackingMap(listingIds: string[]): Promise<Map<string, { retry_count: number; last_retry_at: string | null; recovery_status: string }>> {
  const map = new Map();
  if (listingIds.length === 0) return map;
  try {
    const placeholders = listingIds.map((_, i) => `$${i + 1}`).join(",");
    const { rows } = await pool.query(
      `SELECT listing_id, retry_count, last_retry_at, recovery_status FROM image_backfill_tracking WHERE listing_id IN (${placeholders})`,
      listingIds
    );
    for (const r of rows) {
      map.set(r.listing_id, { retry_count: r.retry_count, last_retry_at: r.last_retry_at, recovery_status: r.recovery_status });
    }
  } catch {}
  return map;
}

async function updateTracking(listingId: string, source: string, success: boolean, method?: string) {
  try {
    if (success) {
      await pool.query(
        `INSERT INTO image_backfill_tracking (listing_id, source, retry_count, last_retry_at, recovery_status, recovered_at, recovered_method)
         VALUES ($1, $2, 1, NOW(), 'recovered', NOW(), $3)
         ON CONFLICT (listing_id) DO UPDATE SET
           retry_count = image_backfill_tracking.retry_count + 1,
           last_retry_at = NOW(),
           recovery_status = 'recovered',
           recovered_at = NOW(),
           recovered_method = $3`,
        [listingId, source, method || null]
      );
    } else {
      const maxRetries = SOURCE_RETRY_LIMITS[source] || 5;
      await pool.query(
        `INSERT INTO image_backfill_tracking (listing_id, source, retry_count, last_retry_at, recovery_status)
         VALUES ($1, $2, 1, NOW(), CASE WHEN 1 >= $3 THEN 'unrecoverable' ELSE 'failed' END)
         ON CONFLICT (listing_id) DO UPDATE SET
           retry_count = image_backfill_tracking.retry_count + 1,
           last_retry_at = NOW(),
           recovery_status = CASE WHEN image_backfill_tracking.retry_count + 1 >= $3 THEN 'unrecoverable' ELSE 'failed' END`,
        [listingId, source, maxRetries]
      );
    }
  } catch {}
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
      .select("id, source_id, url, title, image_url, city, created_at")
      .eq("source", sourceName)
      .or("image_url.is.null,image_url.eq.")
      .order("created_at", { ascending: false })
      .limit(_batchSize * 2);

    if (error) {
      log(`[IMAGE-BACKFILL] ${sourceName} query error: ${error.message}`);
      result.status = "failed";
      result.finished_at = new Date().toISOString();
      return result;
    }

    const raw = (listings || []).filter(l => isPlaceholderOrMissing(l.image_url));

    const trackingMap = await getTrackingMap(raw.map(l => l.id));

    const maxRetries = SOURCE_RETRY_LIMITS[sourceName] || 5;
    const cooldownMs = (RETRY_COOLDOWN_HOURS[sourceName] || 12) * 3600_000;
    const now = Date.now();

    const eligible = raw.filter(l => {
      const t = trackingMap.get(l.id);
      if (!t) return true;
      if (t.recovery_status === "unrecoverable" || t.recovery_status === "recovered") return false;
      if (t.retry_count >= maxRetries) return false;
      if (t.last_retry_at && now - new Date(t.last_retry_at).getTime() < cooldownMs) return false;
      return true;
    });

    eligible.sort((a, b) => {
      const ta = trackingMap.get(a.id);
      const tb = trackingMap.get(b.id);
      const ra = ta?.retry_count || 0;
      const rb = tb?.retry_count || 0;
      if (ra !== rb) return ra - rb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const batch = eligible.slice(0, _batchSize);
    result.skipped_count = raw.length - batch.length;

    log(`[IMAGE-BACKFILL] ${sourceName}: ${batch.length} eligible (${result.skipped_count} skipped — cooldown/maxretries/unrecoverable)`);

    for (const listing of batch) {
      result.processed_count++;
      try {
        await new Promise(r => setTimeout(r, 1200));
        const imgResult = await handler.fetchImage(listing.url, {
          url: listing.url,
          source_id: listing.source_id,
          title: listing.title,
          city: listing.city,
        });
        if (imgResult) {
          const { error: updateErr } = await supabase
            .from("listings")
            .update({ image_url: imgResult.url })
            .eq("id", listing.id);
          if (!updateErr) {
            result.updated_count++;
            result.methods[imgResult.method] = (result.methods[imgResult.method] || 0) + 1;
            await updateTracking(listing.id, sourceName, true, imgResult.method);
          } else {
            result.failed_count++;
            await updateTracking(listing.id, sourceName, false);
          }
        } else {
          result.failed_count++;
          await updateTracking(listing.id, sourceName, false);
        }
      } catch {
        result.failed_count++;
        await updateTracking(listing.id, sourceName, false);
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
    const ordered = [..._enabledSources].sort((a, b) => {
      const pa = SOURCE_PRIORITY.indexOf(a);
      const pb = SOURCE_PRIORITY.indexOf(b);
      return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
    });

    for (const source of ordered) {
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

export async function getRecoveryStats(): Promise<Record<string, { pending: number; recovered: number; failed: number; unrecoverable: number; total_retries: number }>> {
  try {
    const { rows } = await pool.query(
      `SELECT source, recovery_status, COUNT(*)::int AS cnt, COALESCE(SUM(retry_count), 0)::int AS total_retries
       FROM image_backfill_tracking
       GROUP BY source, recovery_status`
    );
    const stats: Record<string, { pending: number; recovered: number; failed: number; unrecoverable: number; total_retries: number }> = {};
    for (const r of rows) {
      if (!stats[r.source]) stats[r.source] = { pending: 0, recovered: 0, failed: 0, unrecoverable: 0, total_retries: 0 };
      stats[r.source][r.recovery_status as "pending" | "recovered" | "failed" | "unrecoverable"] = r.cnt;
      stats[r.source].total_retries += r.total_retries;
    }
    return stats;
  } catch {
    return {};
  }
}
