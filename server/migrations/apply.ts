import { log } from "../log";
import { pool } from "../pg-pool";

export async function runStartupMigration() {
  try {
    const result = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'user_profile_data' ORDER BY ordinal_position"
    );
    if (result.rows.length === 0) {
      log("[MIGRATION] Table 'user_profile_data' not found — it should exist in the Replit PostgreSQL database.", "migration");
    } else {
      log(`[MIGRATION] user_profile_data table OK (${result.rows.length} columns)`, "migration");
    }
  } catch (err: any) {
    log(`[MIGRATION] Error checking user_profile_data: ${err.message}`, "migration");
  }

  await createUserMatchesTable();
  await createFetchRunsTable();
}

async function createUserMatchesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_matches (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL,
        listing_id UUID NOT NULL,
        search_profile_id UUID,
        listing_title TEXT,
        listing_city TEXT,
        listing_price NUMERIC,
        listing_source TEXT,
        listing_url TEXT,
        dedup_key TEXT,
        first_detected_at TIMESTAMPTZ,
        matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        visible_in_app BOOLEAN NOT NULL DEFAULT TRUE,
        email_sent BOOLEAN NOT NULL DEFAULT FALSE,
        email_sent_at TIMESTAMPTZ,
        push_sent BOOLEAN NOT NULL DEFAULT FALSE,
        push_sent_at TIMESTAMPTZ,
        viewed BOOLEAN NOT NULL DEFAULT FALSE,
        viewed_at TIMESTAMPTZ,
        saved BOOLEAN NOT NULL DEFAULT FALSE,
        applied BOOLEAN NOT NULL DEFAULT FALSE,
        dismissed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, listing_id)
      )
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_matches_user_id ON user_matches(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_matches_listing_id ON user_matches(listing_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_matches_matched_at ON user_matches(matched_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_matches_dedup ON user_matches(dedup_key)`);

    const colCheck = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'user_matches' ORDER BY ordinal_position"
    );
    log(`[MIGRATION] user_matches table OK (${colCheck.rows.length} columns)`, "migration");
  } catch (err: any) {
    log(`[MIGRATION] Error creating user_matches: ${err.message}`, "migration");
  }
}

async function createFetchRunsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fetch_runs (
        id SERIAL PRIMARY KEY,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'running',
        fetched_count INT NOT NULL DEFAULT 0,
        normalized_count INT NOT NULL DEFAULT 0,
        deduplicated_count INT NOT NULL DEFAULT 0,
        newly_matched_count INT NOT NULL DEFAULT 0,
        emails_sent_count INT NOT NULL DEFAULT 0,
        pushes_sent_count INT NOT NULL DEFAULT 0,
        error_count INT NOT NULL DEFAULT 0,
        cities_processed INT NOT NULL DEFAULT 0,
        error_message TEXT
      )
    `);

    const colCheck = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'fetch_runs' ORDER BY ordinal_position"
    );
    log(`[MIGRATION] fetch_runs table OK (${colCheck.rows.length} columns)`, "migration");
  } catch (err: any) {
    log(`[MIGRATION] Error creating fetch_runs: ${err.message}`, "migration");
  }
}
