import { pool } from "./pg-pool";
import { log } from "./log";
import type { IngestionReport } from "./ingesters";
import { TIER_1_CITIES, TIER_2_CITIES } from "./ingesters/city-tiers";
import { getCitySlugs } from "./ingesters/city-slugs";
import { getEnabledSources } from "./ingesters";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);

export function isAdminEmail(email: string): boolean {
  if (ADMIN_EMAILS.length === 0) {
    log("[admin] WARNING: ADMIN_EMAILS not set — all admin access denied by default");
    return false;
  }
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

export async function ensureIngestionRunsColumns(): Promise<void> {
  const alterStatements = [
    `ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS error_message text`,
    `ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS source_reports jsonb`,
    `ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS city_reports jsonb`,
    `ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS fast_lane boolean DEFAULT false`,
    `ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS duration_sec numeric`,
  ];
  for (const sql of alterStatements) {
    try {
      await pool.query(sql);
    } catch (err: any) {
      log(`[admin] ensureIngestionRunsColumns: ${err.message}`, "express");
    }
  }
}

export async function persistIngestionRun(
  report: IngestionReport,
  startedAt: Date,
  runErrorMessage?: string
): Promise<void> {
  try {
    const status =
      runErrorMessage
        ? "failed"
        : report.total.errors === 0
          ? "success"
          : report.total.found > 0
            ? "partial"
            : "failed";

    const errorMessage =
      runErrorMessage ??
      (report.total.errors > 0
        ? report.sources
            .filter((s) => s.errors > 0 && s.errorMessage)
            .map((s) => `${s.name}: ${s.errorMessage}`)
            .slice(0, 3)
            .join("; ") || null
        : null);

    await pool.query(
      `INSERT INTO ingestion_runs
        (started_at, finished_at, duration_sec, cities_count, total_found, total_inserted, total_duplicates, total_matches, total_errors, city_reports, source_reports, status, error_message)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
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
        errorMessage,
      ]
    );
    log(`[admin] Ingestion run persisted (status=${status}${errorMessage ? `, error=${errorMessage.slice(0, 80)}` : ""})`, "express");
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
  error_message?: string | null;
}

export async function getRecentRuns(limit = 20): Promise<IngestionRunSummary[]> {
  const { rows } = await pool.query(
    `SELECT id, started_at, finished_at, duration_sec, cities_count,
            total_found, total_inserted, total_duplicates, total_matches, total_errors, status, error_message
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

export interface SourceAggregateRow {
  name: string;
  found: number;
  inserted: number;
  duplicates: number;
  errors: number;
  last_success: string | null;
  errorMessage?: string | null;
}

export async function getSourceAggregates(): Promise<SourceAggregateRow[]> {
  const { rows } = await pool.query(
    `SELECT source_reports, finished_at FROM ingestion_runs ORDER BY finished_at DESC LIMIT 1`
  );
  if (rows.length === 0) return [];

  const sourceReports: Array<{
    name: string; found: number; inserted: number; duplicates: number;
    matches: number; errors: number; errorMessage?: string;
  }> = rows[0].source_reports || [];
  const finishedAt = rows[0].finished_at;

  const agg = new Map<string, SourceAggregateRow>();

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
      if (sr.errors > 0 && sr.errorMessage && !existing.errorMessage) {
        existing.errorMessage = sr.errorMessage;
      }
    } else {
      agg.set(baseName, {
        name: baseName,
        found: sr.found,
        inserted: sr.inserted,
        duplicates: sr.duplicates,
        errors: sr.errors,
        last_success: (sr.errors === 0 && sr.found > 0) ? finishedAt : null,
        errorMessage: sr.errors > 0 ? (sr.errorMessage ?? null) : null,
      });
    }
  }

  return Array.from(agg.values());
}

export interface DynamicCityRow {
  city_name: string;
  country_code: string;
  tier: number;
  active_profiles: number;
  last_scraped_at: string | null;
  listings_last_run: number;
  listings_7d: number;
  active_sources: string[];
  failed_sources: { name: string; reason: string }[];
  health_status: "green" | "yellow" | "red";
}

let _dynamicCitiesCache: { data: DynamicCityRow[]; ts: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

function canonicalKey(name: string): string {
  return name.toLowerCase().trim()
    .replace(/ä/g, "ae").replace(/ö/g, "oe")
    .replace(/ü/g, "ue").replace(/ß/g, "ss");
}

function parseCityFromSourceName(name: string): { source: string; city: string } | null {
  const match = name.match(/^(.+?)\s*\((.+)\)$/);
  if (!match) return null;
  return { source: match[1].trim(), city: match[2].trim() };
}

export async function getDynamicCitiesReport(supabase: any): Promise<DynamicCityRow[]> {
  if (_dynamicCitiesCache && Date.now() - _dynamicCitiesCache.ts < CACHE_TTL_MS) {
    return _dynamicCitiesCache.data;
  }

  const t1Set = new Set(TIER_1_CITIES.map(canonicalKey));
  const t2Set = new Set(TIER_2_CITIES.map(canonicalKey));

  const { data: profiles, error: profErr } = await supabase
    .from("search_profiles")
    .select("city_name, country_code");

  if (profErr) {
    log(`[admin] getDynamicCitiesReport: profile query error: ${profErr.message}`, "express");
    return [];
  }

  const cityMap = new Map<string, { city_name: string; country_code: string; count: number }>();
  for (const p of profiles || []) {
    const name = (p.city_name || "").trim();
    if (!name) continue;
    const key = canonicalKey(name);
    const cc = p.country_code || "DE";
    const compositeKey = `${key}::${cc}`;
    const existing = cityMap.get(compositeKey);
    if (existing) {
      existing.count++;
    } else {
      cityMap.set(compositeKey, { city_name: name, country_code: cc, count: 1 });
    }
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: listings7d } = await supabase
    .from("listings")
    .select("city, source")
    .gte("created_at", sevenDaysAgo);

  const listing7dMap = new Map<string, { count: number; sources: Set<string> }>();
  for (const l of listings7d || []) {
    const c = canonicalKey(l.city || "");
    if (!c) continue;
    const existing = listing7dMap.get(c);
    if (existing) {
      existing.count++;
      existing.sources.add(l.source);
    } else {
      listing7dMap.set(c, { count: 1, sources: new Set([l.source]) });
    }
  }

  const lastScrapedByCity = new Map<string, { found: number; finishedAt: string }>();
  const sourceErrorsByCity = new Map<string, { name: string; reason: string }[]>();
  try {
    const { rows } = await pool.query(
      `SELECT city_reports, source_reports, finished_at FROM ingestion_runs ORDER BY finished_at DESC LIMIT 10`
    );
    for (const row of rows) {
      for (const cr of (row.city_reports || [])) {
        const key = canonicalKey(cr.city || "");
        if (!key) continue;
        if (!lastScrapedByCity.has(key)) {
          lastScrapedByCity.set(key, { found: cr.found || 0, finishedAt: row.finished_at });
        }
      }
      for (const sr of (row.source_reports || [])) {
        if ((sr.errors || 0) === 0 && !sr.error) continue;
        const parsed = parseCityFromSourceName(sr.name || "");
        if (!parsed) continue;
        const key = canonicalKey(parsed.city);
        if (!key) continue;
        if (!sourceErrorsByCity.has(key)) {
          const existing = sourceErrorsByCity.get(key) || [];
          existing.push({ name: parsed.source, reason: sr.error || `${sr.errors} error(s)` });
          sourceErrorsByCity.set(key, existing);
        }
      }
    }
  } catch {}

  const enabledSourceNames = getEnabledSources();

  const results: DynamicCityRow[] = [];
  for (const [compositeKey, info] of cityMap) {
    const key = canonicalKey(info.city_name);
    const tier = t1Set.has(key) ? 1 : t2Set.has(key) ? 2 : 3;
    const listing7dInfo = listing7dMap.get(key);
    const lastScrape = lastScrapedByCity.get(key);
    const listings7dCount = listing7dInfo?.count || 0;

    const slugs = getCitySlugs(info.city_name);
    const activeSources: string[] = [];
    for (const src of enabledSourceNames) {
      if (src === "wg-gesucht" && !slugs?.wgGesuchtCode) continue;
      if (src === "kleinanzeigen" && !slugs?.kleinanzeigenCode) continue;
      activeSources.push(src);
    }

    const health: "green" | "yellow" | "red" =
      listings7dCount > 20 ? "green" : listings7dCount >= 5 ? "yellow" : "red";

    results.push({
      city_name: info.city_name,
      country_code: info.country_code,
      tier,
      active_profiles: info.count,
      last_scraped_at: lastScrape?.finishedAt || null,
      listings_last_run: lastScrape?.found || 0,
      listings_7d: listings7dCount,
      active_sources: activeSources,
      failed_sources: sourceErrorsByCity.get(key) || [],
      health_status: health,
    });
  }

  results.sort((a, b) => b.active_profiles - a.active_profiles || b.listings_last_run - a.listings_last_run);

  _dynamicCitiesCache = { data: results, ts: Date.now() };
  return results;
}
