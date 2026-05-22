import { pool } from "../pg-pool";
import { log } from "../log";
import type { IngestionReport, SourceReport } from "../ingesters";

function parseSourceName(raw: string): { sourceName: string; city: string } {
  const m = raw.match(/^(.+?)\s*\((.+)\)$/);
  if (m) return { sourceName: m[1].trim(), city: m[2].trim() };
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
    const { sourceName, city } = parseSourceName(sr.name);
    const isSuccess = sr.errors === 0;
    const isZero = sr.found === 0;

    const status = !isSuccess
      ? "degraded"
      : isZero
        ? "degraded"
        : "healthy";

    try {
      await pool.query(
        `INSERT INTO source_health
          (source_name, city, last_started_at, last_success_at, last_failure_at,
           duration_ms, found_count, inserted_count, duplicate_count, error_count,
           last_error, status, consecutive_failures, consecutive_zeros, total_runs, updated_at)
         VALUES ($1, $2, $3::TIMESTAMPTZ,
           CASE WHEN $4::BOOLEAN THEN $3::TIMESTAMPTZ ELSE NULL::TIMESTAMPTZ END,
           CASE WHEN NOT $4::BOOLEAN THEN $3::TIMESTAMPTZ ELSE NULL::TIMESTAMPTZ END,
           $5, $6, $7, $8, $9, $10, $11,
           CASE WHEN $4::BOOLEAN THEN 0 ELSE 1 END,
           CASE WHEN $12::BOOLEAN THEN 1 ELSE 0 END,
           1, NOW())
         ON CONFLICT (source_name, city) DO UPDATE SET
           last_started_at   = $3::TIMESTAMPTZ,
           last_success_at   = CASE WHEN $4::BOOLEAN THEN $3::TIMESTAMPTZ ELSE source_health.last_success_at END,
           last_failure_at   = CASE WHEN NOT $4::BOOLEAN THEN $3::TIMESTAMPTZ ELSE source_health.last_failure_at END,
           duration_ms       = $5,
           found_count       = $6,
           inserted_count    = $7,
           duplicate_count   = $8,
           error_count       = $9,
           last_error        = CASE WHEN NOT $4::BOOLEAN THEN $10 ELSE NULL END,
           status            = $11,
           consecutive_failures = CASE WHEN $4::BOOLEAN THEN 0 ELSE source_health.consecutive_failures + 1 END,
           consecutive_zeros    = CASE WHEN $12::BOOLEAN THEN source_health.consecutive_zeros + 1 ELSE 0 END,
           total_runs           = source_health.total_runs + 1,
           updated_at           = NOW()`,
        [
          sourceName,
          city,
          runStartedAt.toISOString(),
          isSuccess,
          sr.durationMs ?? 0,
          sr.found,
          sr.inserted,
          sr.duplicates,
          sr.errors,
          sr.errorMessage ?? null,
          status,
          isZero,
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
