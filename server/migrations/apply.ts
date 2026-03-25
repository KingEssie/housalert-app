import { log } from "../log";
import { pool } from "../pg-pool";
import { createActivationEventsTable } from "../activation-events";
import { createCancellationFeedbackTable } from "../cancellation-feedback";
import { ensureReferralSchema } from "../referrals";

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

  await ensureOnboardingCompletedColumn();
  await ensurePostPaywallColumns();

  await createUserMatchesTable();
  await createFetchRunsTable();
  await createActivationEventsTable();
  await createCancellationFeedbackTable();
  await ensureReferralSchema(pool);
  await createFavoritesTable();
}

async function createFavoritesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        listing_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, listing_id)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id)`);

    const colCheck = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'favorites' ORDER BY ordinal_position"
    );
    log(`[MIGRATION] favorites table OK (${colCheck.rows.length} columns)`, "migration");
  } catch (err: any) {
    log(`[MIGRATION] Error creating favorites: ${err.message}`, "migration");
  }
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

async function ensurePostPaywallColumns() {
  const cols = [
    { name: "gender", sql: "TEXT" },
    { name: "living_with", sql: "TEXT" },
    { name: "work_status", sql: "TEXT" },
    { name: "move_reason", sql: "TEXT" },
    { name: "pets_count", sql: "INTEGER DEFAULT 0" },
    { name: "post_paywall_onboarding_completed", sql: "BOOLEAN DEFAULT false" },
    { name: "onboarding_current_step", sql: "TEXT" },
    { name: "push_test_completed", sql: "BOOLEAN DEFAULT false" },
  ];

  for (const col of cols) {
    try {
      const exists = await pool.query(
        "SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profile_data' AND column_name = $1",
        [col.name]
      );
      if (exists.rows.length === 0) {
        await pool.query(`ALTER TABLE user_profile_data ADD COLUMN ${col.name} ${col.sql}`);
        log(`[MIGRATION] Added ${col.name} column to user_profile_data`, "migration");
      }
    } catch (err: any) {
      log(`[MIGRATION] Error adding ${col.name}: ${err.message}`, "migration");
    }
  }
}

async function ensureOnboardingCompletedColumn() {
  try {
    const colExists = await pool.query(
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profile_data' AND column_name = 'onboarding_completed'"
    );
    if (colExists.rows.length === 0) {
      await pool.query("ALTER TABLE user_profile_data ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT false");
      log("[MIGRATION] Added onboarding_completed column to user_profile_data", "migration");
    } else {
      log("[MIGRATION] onboarding_completed column already exists", "migration");
    }
  } catch (err: any) {
    log(`[MIGRATION] Error adding onboarding_completed: ${err.message}`, "migration");
  }
}
