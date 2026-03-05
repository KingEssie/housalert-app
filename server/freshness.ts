import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function trackListingSeen(
  listingId: string,
  source: string,
  sourceId: string
): Promise<void> {
  await pool.query(
    `INSERT INTO listing_freshness (listing_id, source, source_id, first_seen_at, last_seen_at)
     VALUES ($1, $2, $3, now(), now())
     ON CONFLICT (listing_id) DO UPDATE SET last_seen_at = now()`,
    [listingId, source, sourceId]
  );
}

export async function getListingFreshness(
  listingIds: string[]
): Promise<
  Record<string, { first_seen_at: string; last_seen_at: string }>
> {
  if (listingIds.length === 0) return {};

  const { rows } = await pool.query(
    `SELECT listing_id, first_seen_at, last_seen_at
     FROM listing_freshness
     WHERE listing_id = ANY($1)`,
    [listingIds]
  );

  const result: Record<string, { first_seen_at: string; last_seen_at: string }> = {};
  for (const row of rows) {
    result[row.listing_id] = {
      first_seen_at: row.first_seen_at.toISOString(),
      last_seen_at: row.last_seen_at.toISOString(),
    };
  }
  return result;
}

export interface FreshListingRow {
  listing_id: string;
  source: string;
  first_seen_at: string;
}

export async function getNewestListingIds(
  limit: number
): Promise<FreshListingRow[]> {
  const { rows } = await pool.query(
    `SELECT listing_id, source, first_seen_at
     FROM listing_freshness
     ORDER BY first_seen_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map((r: any) => ({
    listing_id: r.listing_id,
    source: r.source,
    first_seen_at: r.first_seen_at.toISOString(),
  }));
}

export async function trackMatchCreated(matchId: string): Promise<void> {
  await pool.query(
    `INSERT INTO match_timestamps (match_id, matched_at)
     VALUES ($1, now())
     ON CONFLICT (match_id) DO NOTHING`,
    [matchId]
  );
}

export async function getMatchTimestamps(
  matchIds: string[]
): Promise<Record<string, string>> {
  if (matchIds.length === 0) return {};

  const { rows } = await pool.query(
    `SELECT match_id, matched_at
     FROM match_timestamps
     WHERE match_id = ANY($1)`,
    [matchIds]
  );

  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.match_id] = row.matched_at.toISOString();
  }
  return result;
}
