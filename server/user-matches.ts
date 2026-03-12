import { pool } from "./pg-pool";
import { log } from "./log";

let tableReady = false;

async function ensureTable(): Promise<boolean> {
  if (tableReady) return true;
  try {
    await pool.query("SELECT 1 FROM user_matches LIMIT 0");
    tableReady = true;
    return true;
  } catch {
    return false;
  }
}

export interface UpsertUserMatch {
  user_id: string;
  listing_id: string;
  search_profile_id?: string;
  listing_title?: string;
  listing_city?: string;
  listing_price?: number;
  listing_source?: string;
  listing_url?: string | null;
  dedup_key?: string;
  first_detected_at?: string;
  matched_at?: string;
}

export async function upsertUserMatch(match: UpsertUserMatch): Promise<boolean> {
  if (!(await ensureTable())) return false;
  try {
    await pool.query(
      `INSERT INTO user_matches (
        user_id, listing_id, search_profile_id,
        listing_title, listing_city, listing_price, listing_source, listing_url,
        dedup_key, first_detected_at, matched_at, visible_in_app
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE)
      ON CONFLICT (user_id, listing_id) DO UPDATE SET
        search_profile_id = COALESCE(user_matches.search_profile_id, EXCLUDED.search_profile_id),
        listing_title = COALESCE(EXCLUDED.listing_title, user_matches.listing_title),
        listing_city = COALESCE(EXCLUDED.listing_city, user_matches.listing_city),
        listing_price = COALESCE(EXCLUDED.listing_price, user_matches.listing_price),
        listing_source = COALESCE(EXCLUDED.listing_source, user_matches.listing_source),
        listing_url = COALESCE(EXCLUDED.listing_url, user_matches.listing_url),
        dedup_key = COALESCE(EXCLUDED.dedup_key, user_matches.dedup_key)`,
      [
        match.user_id,
        match.listing_id,
        match.search_profile_id || null,
        match.listing_title || null,
        match.listing_city || null,
        match.listing_price || null,
        match.listing_source || null,
        match.listing_url || null,
        match.dedup_key || null,
        match.first_detected_at || null,
        match.matched_at || new Date().toISOString(),
      ]
    );
    return true;
  } catch (err: any) {
    if (err.code !== "23505") {
      log(`[user-matches] upsert error: ${err.message}`);
    }
    return false;
  }
}

export async function markEmailSent(userId: string, listingIds: string[]): Promise<void> {
  if (!(await ensureTable()) || listingIds.length === 0) return;
  try {
    await pool.query(
      `UPDATE user_matches SET email_sent = TRUE, email_sent_at = NOW()
       WHERE user_id = $1 AND listing_id = ANY($2) AND email_sent = FALSE`,
      [userId, listingIds]
    );
  } catch (err: any) {
    log(`[user-matches] markEmailSent error: ${err.message}`);
  }
}

export async function markPushSent(userId: string, listingIds: string[]): Promise<void> {
  if (!(await ensureTable()) || listingIds.length === 0) return;
  try {
    await pool.query(
      `UPDATE user_matches SET push_sent = TRUE, push_sent_at = NOW()
       WHERE user_id = $1 AND listing_id = ANY($2) AND push_sent = FALSE`,
      [userId, listingIds]
    );
  } catch (err: any) {
    log(`[user-matches] markPushSent error: ${err.message}`);
  }
}

export async function markViewed(userId: string, listingIds: string[]): Promise<void> {
  if (!(await ensureTable()) || listingIds.length === 0) return;
  try {
    await pool.query(
      `UPDATE user_matches SET viewed = TRUE, viewed_at = NOW()
       WHERE user_id = $1 AND listing_id = ANY($2) AND viewed = FALSE`,
      [userId, listingIds]
    );
  } catch (err: any) {
    log(`[user-matches] markViewed error: ${err.message}`);
  }
}

export async function markApplied(userId: string, listingId: string, applied: boolean = true): Promise<void> {
  if (!(await ensureTable())) return;
  try {
    await pool.query(
      `UPDATE user_matches SET applied = $3 WHERE user_id = $1 AND listing_id = $2`,
      [userId, listingId, applied]
    );
  } catch (err: any) {
    log(`[user-matches] markApplied error: ${err.message}`);
  }
}

export interface UserMatchStats {
  total: number;
  new_count: number;
  viewed: number;
  saved: number;
  applied: number;
  email_sent: number;
  push_sent: number;
}

export async function getUserMatchStats(userId: string): Promise<UserMatchStats | null> {
  if (!(await ensureTable())) return null;
  try {
    const result = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE visible_in_app AND NOT dismissed)::int as total,
        COUNT(*) FILTER (WHERE visible_in_app AND NOT dismissed AND NOT viewed AND NOT saved AND NOT applied)::int as new_count,
        COUNT(*) FILTER (WHERE visible_in_app AND NOT dismissed AND viewed AND NOT saved AND NOT applied)::int as viewed,
        COUNT(*) FILTER (WHERE visible_in_app AND NOT dismissed AND saved AND NOT applied)::int as saved,
        COUNT(*) FILTER (WHERE visible_in_app AND NOT dismissed AND applied)::int as applied,
        COUNT(*) FILTER (WHERE email_sent)::int as email_sent,
        COUNT(*) FILTER (WHERE push_sent)::int as push_sent
       FROM user_matches WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  } catch (err: any) {
    log(`[user-matches] getUserMatchStats error: ${err.message}`);
    return null;
  }
}

export interface RecentUserMatch {
  id: number;
  listing_id: string;
  search_profile_id: string | null;
  listing_title: string | null;
  listing_city: string | null;
  listing_price: number | null;
  listing_source: string | null;
  listing_url: string | null;
  dedup_key: string | null;
  first_detected_at: string | null;
  matched_at: string;
  visible_in_app: boolean;
  email_sent: boolean;
  email_sent_at: string | null;
  push_sent: boolean;
  push_sent_at: string | null;
  viewed: boolean;
  applied: boolean;
  saved: boolean;
  dismissed: boolean;
}

export async function getRecentUserMatches(userId: string, limit: number = 50): Promise<RecentUserMatch[]> {
  if (!(await ensureTable())) return [];
  try {
    const result = await pool.query(
      `SELECT * FROM user_matches WHERE user_id = $1 ORDER BY matched_at DESC LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  } catch (err: any) {
    log(`[user-matches] getRecentUserMatches error: ${err.message}`);
    return [];
  }
}

export interface CanonicalMatchState {
  listing_id: string;
  viewed: boolean;
  saved: boolean;
  applied: boolean;
  dismissed: boolean;
  email_sent: boolean;
  push_sent: boolean;
}

export async function getCanonicalMatchStates(userId: string): Promise<Map<string, CanonicalMatchState>> {
  const map = new Map<string, CanonicalMatchState>();
  if (!(await ensureTable())) return map;
  try {
    const result = await pool.query(
      `SELECT listing_id, viewed, saved, applied, dismissed, email_sent, push_sent
       FROM user_matches WHERE user_id = $1`,
      [userId]
    );
    for (const row of result.rows) {
      map.set(row.listing_id, row);
    }
  } catch (err: any) {
    log(`[user-matches] getCanonicalMatchStates error: ${err.message}`);
  }
  return map;
}

export async function markSaved(userId: string, listingId: string, saved: boolean = true): Promise<boolean> {
  if (!(await ensureTable())) return false;
  try {
    const result = await pool.query(
      `UPDATE user_matches SET saved = $3 WHERE user_id = $1 AND listing_id = $2`,
      [userId, listingId, saved]
    );
    return (result.rowCount ?? 0) > 0;
  } catch (err: any) {
    log(`[user-matches] markSaved error: ${err.message}`);
    return false;
  }
}

export async function getMatchCountForUser(userId: string): Promise<{ total: number; new_count: number }> {
  if (!(await ensureTable())) return { total: 0, new_count: 0 };
  try {
    const result = await pool.query(
      `SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE visible_in_app AND NOT dismissed AND NOT viewed AND NOT saved AND NOT applied)::int as new_count
       FROM user_matches WHERE user_id = $1 AND visible_in_app = TRUE AND NOT dismissed`,
      [userId]
    );
    return result.rows[0] || { total: 0, new_count: 0 };
  } catch (err: any) {
    log(`[user-matches] getMatchCountForUser error: ${err.message}`);
    return { total: 0, new_count: 0 };
  }
}

export async function backfillFromSupabaseMatches(
  supabaseMatches: Array<{
    user_id: string;
    listing_id: string;
    search_profile_id: string;
    created_at: string;
  }>,
  listingMap: Record<string, { title?: string; city?: string; price?: number; source?: string; url?: string; source_id?: string }>,
  pushSentMap: Record<string, Set<string>>
): Promise<number> {
  if (!(await ensureTable())) return 0;

  let count = 0;
  const seen = new Set<string>();

  for (const m of supabaseMatches) {
    const key = `${m.user_id}:${m.listing_id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const listing = listingMap[m.listing_id];
    const pushSent = pushSentMap[m.user_id]?.has(m.listing_id) || false;

    try {
      const result = await pool.query(
        `INSERT INTO user_matches (
          user_id, listing_id, search_profile_id,
          listing_title, listing_city, listing_price, listing_source, listing_url,
          dedup_key, matched_at, visible_in_app, push_sent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, $11)
        ON CONFLICT (user_id, listing_id) DO NOTHING`,
        [
          m.user_id,
          m.listing_id,
          m.search_profile_id,
          listing?.title || null,
          listing?.city || null,
          listing?.price || null,
          listing?.source || null,
          listing?.url || null,
          listing ? `${listing.source || ""}:${listing.source_id || m.listing_id}` : null,
          m.created_at,
          pushSent,
        ]
      );
      if (result.rowCount && result.rowCount > 0) {
        count++;
      }
    } catch (err: any) {
      if (err.code !== "23505") {
        log(`[user-matches] backfill error: ${err.message}`);
      }
    }
  }

  return count;
}

export async function createFetchRun(): Promise<number | null> {
  try {
    const result = await pool.query(
      `INSERT INTO fetch_runs (started_at, status) VALUES (NOW(), 'running') RETURNING id`
    );
    return result.rows[0]?.id || null;
  } catch (err: any) {
    log(`[fetch-runs] create error: ${err.message}`);
    return null;
  }
}

export async function completeFetchRun(
  runId: number,
  stats: {
    fetched_count: number;
    deduplicated_count: number;
    newly_matched_count: number;
    emails_sent_count: number;
    pushes_sent_count: number;
    error_count: number;
    cities_processed: number;
  }
): Promise<void> {
  try {
    await pool.query(
      `UPDATE fetch_runs SET
        completed_at = NOW(),
        status = 'completed',
        fetched_count = $2,
        deduplicated_count = $3,
        newly_matched_count = $4,
        emails_sent_count = $5,
        pushes_sent_count = $6,
        error_count = $7,
        cities_processed = $8
       WHERE id = $1`,
      [
        runId,
        stats.fetched_count,
        stats.deduplicated_count,
        stats.newly_matched_count,
        stats.emails_sent_count,
        stats.pushes_sent_count,
        stats.error_count,
        stats.cities_processed,
      ]
    );
  } catch (err: any) {
    log(`[fetch-runs] complete error: ${err.message}`);
  }
}

export async function failFetchRun(runId: number, errorMessage: string): Promise<void> {
  try {
    await pool.query(
      `UPDATE fetch_runs SET completed_at = NOW(), status = 'failed', error_message = $2 WHERE id = $1`,
      [runId, errorMessage]
    );
  } catch (err: any) {
    log(`[fetch-runs] fail error: ${err.message}`);
  }
}

export interface UndeliveredMatch {
  user_id: string;
  listing_id: string;
  listing_title: string;
  listing_city: string;
  listing_price: number;
  listing_url: string | null;
  matched_at: string;
}

export async function getUndeliveredMatches(maxAgeHours: number = 24): Promise<UndeliveredMatch[]> {
  if (!(await ensureTable())) return [];
  try {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();
    const result = await pool.query(
      `SELECT user_id, listing_id, listing_title, listing_city, listing_price, listing_url, matched_at
       FROM user_matches
       WHERE email_sent = false
         AND push_sent = false
         AND visible_in_app = true
         AND dismissed = false
         AND matched_at >= $1
       ORDER BY matched_at DESC`,
      [cutoff]
    );
    return result.rows;
  } catch (err: any) {
    log(`[user-matches] getUndeliveredMatches error: ${err.message}`);
    return [];
  }
}

export async function cleanupStaleFetchRuns(): Promise<number> {
  try {
    const result = await pool.query(
      `UPDATE fetch_runs SET
        completed_at = NOW(),
        status = 'interrupted',
        error_message = 'Server restarted before completion'
       WHERE status = 'running'
         AND started_at < NOW() - INTERVAL '5 minutes'
       RETURNING id`
    );
    return result.rowCount || 0;
  } catch (err: any) {
    log(`[fetch-runs] cleanup error: ${err.message}`);
    return 0;
  }
}

export async function getRecentFetchRuns(limit: number = 10): Promise<any[]> {
  try {
    const result = await pool.query(
      `SELECT * FROM fetch_runs ORDER BY started_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  } catch (err: any) {
    log(`[fetch-runs] getRecent error: ${err.message}`);
    return [];
  }
}
