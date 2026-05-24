import { pool } from "../pg-pool";
import { log } from "../log";
import type { IngestionReport, SourceReport } from "../ingesters";

export function parseSourceName(raw: string): { sourceName: string; city: string } {
  const m = raw.match(/^(.+?)\s*\((.+)\)$/);
  if (m) {
    let sourceName = m[1].trim();
    const city = m[2].trim();
    // German ingester emits "source:city (city)" — strip the redundant ":city" suffix.
    if (sourceName.toLowerCase().endsWith(`:${city.toLowerCase()}`)) {
      sourceName = sourceName.slice(0, sourceName.length - 1 - city.length);
    }
    return { sourceName, city };
  }
  return { sourceName: raw.trim(), city: "" };
}

export async function ensureMonitoringTables(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS source_health (
        id SERIAL PRIMARY KEY,
        source_name TEXT NOT NULL,
        city TEXT NOT NULL DEFAULT '',
        last_started_at TIMESTAMPTZ,
        last_success_at TIMESTAMPTZ,
        last_failure_at TIMESTAMPTZ,
        duration_ms INTEGER DEFAULT 0,
        found_count INTEGER DEFAULT 0,
        inserted_count INTEGER DEFAULT 0,
        duplicate_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        last_error TEXT,
        status TEXT DEFAULT 'unknown',
        consecutive_failures INTEGER DEFAULT 0,
        consecutive_zeros INTEGER DEFAULT 0,
        total_runs INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (source_name, city)
      );
      CREATE TABLE IF NOT EXISTS admin_alerts (
        id SERIAL PRIMARY KEY,
        alert_key TEXT NOT NULL,
        alert_type TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'warning',
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        source_name TEXT,
        city TEXT,
        metadata JSONB DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'open',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        last_notified_at TIMESTAMPTZ,
        notification_count INTEGER DEFAULT 0
      );
      CREATE UNIQUE INDEX IF NOT EXISTS admin_alerts_open_key
        ON admin_alerts (alert_key) WHERE status = 'open';
    `);
  } catch (err: any) {
    log(`[monitoring] ensureMonitoringTables: ${err.message}`);
  }
}

export async function upsertSourceHealth(report: IngestionReport, runStartedAt: Date): Promise<void> {
  if (!report.sources || report.sources.length === 0) return;

  const now = new Date();

  for (const sr of report.sources) {
    // sr.name may be undefined in backfill data from ingestion_runs JSONB —
    // fall back to sr.source so the row is stored under a meaningful key.
    const rawName = (sr as any).name || (sr as any).source || "unknown";
    const { sourceName, city } = parseSourceName(rawName);
    // A run is a "data success" only when it found actual listings (no errors AND found > 0).
    // A run is a "failure" only when it had actual errors (errors > 0).
    // A zero-result run (errors=0, found=0) neither advances last_success_at nor
    // last_failure_at — it only increments consecutive_zeros.
    // This prevents blocked sources (403 → found=0, errors=0) from incorrectly
    // showing "last success: just now" in the dashboard.
    const isActualSuccess = sr.errors === 0 && sr.found > 0;
    const isActualFailure = sr.errors > 0;
    const isZero          = sr.found === 0;

    const status = isActualSuccess ? "healthy" : "degraded";

    // Pre-compute nullable timestamps in JS to avoid $N parameter reuse
    // inside CASE expressions (PostgreSQL type-inference ambiguity).
    const startedAtIso  = runStartedAt.toISOString();
    const successAtIso  = isActualSuccess ? startedAtIso : null;
    const failureAtIso  = isActualFailure ? startedAtIso : null;
    const consecutiveFailuresOnInsert = isActualFailure ? 1 : 0;
    const consecutiveZerosOnInsert    = isZero           ? 1 : 0;

    try {
      await pool.query(
        `INSERT INTO source_health
          (source_name, city, last_started_at, last_success_at, last_failure_at,
           duration_ms, found_count, inserted_count, duplicate_count, error_count,
           last_error, status, consecutive_failures, consecutive_zeros, total_runs, updated_at)
         VALUES ($1, $2, $3::TIMESTAMPTZ, $4::TIMESTAMPTZ, $5::TIMESTAMPTZ,
                 $6, $7, $8, $9, $10, $11, $12,
                 $13, $14, 1, NOW())
         ON CONFLICT (source_name, city) DO UPDATE SET
           last_started_at   = $3::TIMESTAMPTZ,
           -- Only advance last_success_at when this run actually found listings ($4 non-null).
           -- Zero-result runs (found=0, errors=0) leave last_success_at unchanged.
           last_success_at   = CASE WHEN $4::TIMESTAMPTZ IS NOT NULL THEN $4::TIMESTAMPTZ ELSE source_health.last_success_at END,
           -- Only advance last_failure_at when there were actual errors ($5 non-null).
           last_failure_at   = CASE WHEN $5::TIMESTAMPTZ IS NOT NULL THEN $5::TIMESTAMPTZ ELSE source_health.last_failure_at END,
           duration_ms       = $6,
           found_count       = $7,
           inserted_count    = $8,
           duplicate_count   = $9,
           error_count       = $10,
           last_error        = CASE WHEN $5::TIMESTAMPTZ IS NOT NULL THEN $11 ELSE source_health.last_error END,
           -- Never overwrite a manually-set 'disabled' status — disabled sources are
           -- excluded by the ingester so they should not revert to 'degraded' via backfill.
           status            = CASE WHEN source_health.status = 'disabled' THEN 'disabled' ELSE $12 END,
           -- consecutive_failures only resets on a data-success run ($4 non-null);
           -- increments only on an actual-error run ($15=true);
           -- zero-result runs leave it unchanged.
           consecutive_failures = CASE
             WHEN $4::TIMESTAMPTZ IS NOT NULL THEN 0
             WHEN $15::boolean THEN source_health.consecutive_failures + 1
             ELSE source_health.consecutive_failures
           END,
           consecutive_zeros    = CASE WHEN $14 = 1 THEN source_health.consecutive_zeros + 1 ELSE 0 END,
           total_runs           = source_health.total_runs + 1,
           updated_at           = NOW()`,
        [
          sourceName,               // $1
          city,                     // $2
          startedAtIso,             // $3  last_started_at
          successAtIso,             // $4  last_success_at (null unless found > 0 AND errors = 0)
          failureAtIso,             // $5  last_failure_at (null unless errors > 0)
          sr.durationMs ?? 0,       // $6
          sr.found,                 // $7
          sr.inserted,              // $8
          sr.duplicates,            // $9
          sr.errors,                // $10
          sr.errorMessage ?? null,  // $11
          status,                   // $12
          consecutiveFailuresOnInsert, // $13
          consecutiveZerosOnInsert,    // $14
          isActualFailure,             // $15  true when errors > 0 (drives consecutive_failures on UPDATE)
        ]
      );
    } catch (err: any) {
      log(`[monitoring] upsertSourceHealth error for ${sourceName}/${city}: ${err.message}`);
    }
  }
}

export interface SourceHealthRow {
  id: number;
  source_name: string;
  city: string;
  last_started_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  duration_ms: number;
  found_count: number;
  inserted_count: number;
  duplicate_count: number;
  error_count: number;
  last_error: string | null;
  status: string;
  consecutive_failures: number;
  consecutive_zeros: number;
  total_runs: number;
  updated_at: string;
}

export async function getSourceHealthSummary(): Promise<SourceHealthRow[]> {
  const { rows } = await pool.query(
    `SELECT * FROM source_health ORDER BY status DESC, source_name, city LIMIT 500`
  );
  return rows;
}

export async function backfillSourceHealthFromRuns(force = false): Promise<{ processed: number }> {
  try {
    if (!force) {
      const { rows: countRows } = await pool.query("SELECT COUNT(*) AS cnt FROM source_health");
      if (parseInt(countRows[0]?.cnt ?? "1", 10) > 0) return { processed: 0 };
    }

    const { rows: runRows } = await pool.query(
      `SELECT source_reports, started_at
       FROM ingestion_runs
       WHERE source_reports IS NOT NULL
         AND started_at IS NOT NULL
       ORDER BY started_at ASC
       LIMIT 200`
    );
    if (runRows.length === 0) return { processed: 0 };

    log(`[source-health] backfilling from ${runRows.length} ingestion runs (force=${force})`);
    let processed = 0;
    for (const run of runRows) {
      if (!Array.isArray(run.source_reports) || run.source_reports.length === 0) continue;
      const report = { sources: run.source_reports };
      await upsertSourceHealth(report as import("../ingesters").IngestionReport, new Date(run.started_at));
      processed++;
    }
    log(`[source-health] backfill complete — processed ${processed} runs`);
    return { processed };
  } catch (err: any) {
    log(`[source-health] backfill error: ${err.message}`);
    return { processed: 0 };
  }
}

/**
 * Build synthetic SourceHealthRow objects directly from a source_reports JSONB array
 * (e.g. from ingestion_runs) without writing to the DB.  Used as a last-resort fallback
 * when source_health is empty and backfill found nothing.
 */
export function synthesizeSourceHealthRows(sourceReports: any[], runFinishedAt?: Date): SourceHealthRow[] {
  const ts = (runFinishedAt ?? new Date()).toISOString();
  const rows: SourceHealthRow[] = [];
  for (const sr of sourceReports) {
    if (!sr) continue;
    const rawName = (sr as any).name || (sr as any).source || "unknown";
    const { sourceName, city } = parseSourceName(rawName);
    const isSuccess = (sr.errors === 0 || sr.errors == null) && (sr.found ?? 0) > 0;
    const isFailure = (sr.errors ?? 0) > 0;
    rows.push({
      id: 0,
      source_name: sourceName,
      city,
      last_started_at: ts,
      last_success_at: isSuccess ? ts : null,
      last_failure_at: isFailure ? ts : null,
      duration_ms: sr.durationMs ?? 0,
      found_count: sr.found ?? 0,
      inserted_count: sr.inserted ?? 0,
      duplicate_count: sr.duplicates ?? 0,
      error_count: sr.errors ?? 0,
      last_error: isFailure ? (sr.errorMessage ?? null) : null,
      status: isSuccess ? "healthy" : "degraded",
      consecutive_failures: isFailure ? 1 : 0,
      consecutive_zeros: (!isSuccess && !isFailure) ? 1 : 0,
      total_runs: 1,
      updated_at: ts,
    });
  }
  return rows;
}

export async function getStaleSourceHealth(thresholdMinutes = 60): Promise<SourceHealthRow[]> {
  const { rows } = await pool.query(
    `SELECT * FROM source_health
     WHERE last_success_at IS NULL
        OR last_success_at < NOW() - ($1 || ' minutes')::interval
     ORDER BY last_success_at ASC NULLS FIRST`,
    [thresholdMinutes]
  );
  return rows;
}
