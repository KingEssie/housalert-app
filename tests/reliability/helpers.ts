import pg from "pg";

let _pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!_pool) {
    _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
}

export async function closePool() {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

function pad(n: number): string {
  return n.toString().padStart(12, "0");
}

export function testUserId(n: number = 1): string {
  return `aaaaaaaa-bbbb-cccc-dddd-${pad(n)}`;
}

export function testListingId(n: number = 1): string {
  return `11111111-2222-3333-4444-${pad(n)}`;
}

export function testProfileId(n: number = 1): string {
  return `55555555-6666-7777-8888-${pad(n)}`;
}

const TEST_USER_PREFIX = "aaaaaaaa-bbbb-cccc-dddd-";
const TEST_FETCH_TAG = "__reliability_test__";

export async function cleanTestData() {
  const pool = getPool();
  await pool.query(
    `DELETE FROM user_matches WHERE user_id::text LIKE $1`,
    [`${TEST_USER_PREFIX}%`]
  );
  await pool.query(
    `DELETE FROM fetch_runs WHERE error_message = $1`,
    [TEST_FETCH_TAG]
  );
}

export async function insertCanonicalMatch(opts: {
  user_id: string;
  listing_id: string;
  search_profile_id?: string;
  listing_title?: string;
  listing_city?: string;
  listing_price?: number;
  listing_source?: string;
  listing_url?: string;
  matched_at?: string;
  visible_in_app?: boolean;
  email_sent?: boolean;
  push_sent?: boolean;
  viewed?: boolean;
  applied?: boolean;
}) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO user_matches (
      user_id, listing_id, search_profile_id,
      listing_title, listing_city, listing_price, listing_source, listing_url,
      matched_at, visible_in_app, email_sent, push_sent, viewed, applied
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    ON CONFLICT (user_id, listing_id) DO NOTHING`,
    [
      opts.user_id,
      opts.listing_id,
      opts.search_profile_id || null,
      opts.listing_title || "Test Listing",
      opts.listing_city || "Berlin",
      opts.listing_price || 800,
      opts.listing_source || "test",
      opts.listing_url || null,
      opts.matched_at || new Date().toISOString(),
      opts.visible_in_app ?? true,
      opts.email_sent ?? false,
      opts.push_sent ?? false,
      opts.viewed ?? false,
      opts.applied ?? false,
    ]
  );
}

export async function getCanonicalMatches(userId: string) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM user_matches WHERE user_id = $1 ORDER BY matched_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function getCanonicalStats(userId: string) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE visible_in_app AND NOT viewed AND NOT dismissed)::int as new_count,
      COUNT(*) FILTER (WHERE viewed)::int as viewed,
      COUNT(*) FILTER (WHERE applied)::int as applied,
      COUNT(*) FILTER (WHERE email_sent)::int as email_sent,
      COUNT(*) FILTER (WHERE push_sent)::int as push_sent
     FROM user_matches WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0];
}

export async function insertFetchRun(stats: {
  fetched_count: number;
  deduplicated_count: number;
  newly_matched_count: number;
  emails_sent_count: number;
  pushes_sent_count: number;
  error_count?: number;
  cities_processed?: number;
}): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO fetch_runs (
      started_at, completed_at, status,
      fetched_count, deduplicated_count, newly_matched_count,
      emails_sent_count, pushes_sent_count, error_count, cities_processed, error_message
    ) VALUES (NOW(), NOW(), 'completed', $1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [
      stats.fetched_count,
      stats.deduplicated_count,
      stats.newly_matched_count,
      stats.emails_sent_count,
      stats.pushes_sent_count,
      stats.error_count || 0,
      stats.cities_processed || 1,
      TEST_FETCH_TAG,
    ]
  );
  return result.rows[0].id;
}

export async function getFetchRun(id: number) {
  const pool = getPool();
  const result = await pool.query(`SELECT * FROM fetch_runs WHERE id = $1`, [id]);
  return result.rows[0];
}
