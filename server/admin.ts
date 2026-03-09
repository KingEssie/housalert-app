import { pool } from "./pg-pool";
import { log } from "./log";
import type { IngestionReport } from "./ingesters";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);

export function isAdminEmail(email: string): boolean {
  if (ADMIN_EMAILS.length === 0) return true;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

export async function persistIngestionRun(report: IngestionReport, startedAt: Date): Promise<void> {
  try {
    const status = report.total.errors === 0
      ? "success"
      : report.total.inserted > 0
        ? "partial"
        : "failed";

    await pool.query(
      `INSERT INTO ingestion_runs
        (started_at, finished_at, duration_sec, cities_count, total_found, total_inserted, total_duplicates, total_matches, total_errors, city_reports, source_reports, status)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        startedAt.toISOString(),
        report.durationSec,
        report.cities.length,
        report.total.found,
        report.total.inserted,
        report.total.duplicates,
        report.total.matches,
        report.total.errors,
        JSON.stringify(report.cityReports),
        JSON.stringify(report.sources),
        status,
      ]
    );
    log(`[admin] Ingestion run persisted (status=${status})`, "express");
  } catch (err: any) {
    log(`[admin] Failed to persist ingestion run: ${err.message}`, "express");
  }
}

export interface IngestionRunSummary {
  id: number;
  started_at: string;
  finished_at: string;
  duration_sec: number;
  cities_count: number;
  total_found: number;
  total_inserted: number;
  total_duplicates: number;
  total_matches: number;
  total_errors: number;
  status: string;
}

export async function getRecentRuns(limit = 20): Promise<IngestionRunSummary[]> {
  const { rows } = await pool.query(
    `SELECT id, started_at, finished_at, duration_sec, cities_count,
            total_found, total_inserted, total_duplicates, total_matches, total_errors, status
     FROM ingestion_runs
     ORDER BY finished_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function getRunDetail(id: number) {
  const { rows } = await pool.query(
    `SELECT * FROM ingestion_runs WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function getLatestRunCities() {
  const { rows } = await pool.query(
    `SELECT city_reports FROM ingestion_runs ORDER BY finished_at DESC LIMIT 1`
  );
  if (rows.length === 0) return [];
  return rows[0].city_reports || [];
}

export async function getLatestRunSources() {
  const { rows } = await pool.query(
    `SELECT source_reports FROM ingestion_runs ORDER BY finished_at DESC LIMIT 1`
  );
  if (rows.length === 0) return [];
  return rows[0].source_reports || [];
}

export async function getSourceAggregates() {
  const { rows } = await pool.query(
    `SELECT source_reports, finished_at FROM ingestion_runs ORDER BY finished_at DESC LIMIT 1`
  );
  if (rows.length === 0) return [];

  const sourceReports: Array<{ name: string; found: number; inserted: number; duplicates: number; matches: number; errors: number }> = rows[0].source_reports || [];
  const finishedAt = rows[0].finished_at;

  const agg = new Map<string, { name: string; found: number; inserted: number; duplicates: number; errors: number; last_success: string | null }>();

  for (const sr of sourceReports) {
    const baseName = sr.name.replace(/\s*\(.*\)$/, "");
    const existing = agg.get(baseName);
    if (existing) {
      existing.found += sr.found;
      existing.inserted += sr.inserted;
      existing.duplicates += sr.duplicates;
      existing.errors += sr.errors;
      if (sr.errors === 0 && sr.found > 0) {
        existing.last_success = finishedAt;
      }
    } else {
      agg.set(baseName, {
        name: baseName,
        found: sr.found,
        inserted: sr.inserted,
        duplicates: sr.duplicates,
        errors: sr.errors,
        last_success: (sr.errors === 0 && sr.found > 0) ? finishedAt : null,
      });
    }
  }

  return Array.from(agg.values());
}
