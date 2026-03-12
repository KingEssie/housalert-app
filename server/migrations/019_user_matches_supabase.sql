-- Migration 019: user_matches canonical tracking table
-- NOTE: This table is currently auto-created in Replit PostgreSQL at startup.
-- This SQL is provided for future migration to Supabase if desired.
-- Run this in the Supabase SQL Editor if you want to move user_matches to Supabase.

CREATE TABLE IF NOT EXISTS user_matches (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
);

CREATE INDEX IF NOT EXISTS idx_user_matches_user_id ON user_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_user_matches_listing_id ON user_matches(listing_id);
CREATE INDEX IF NOT EXISTS idx_user_matches_matched_at ON user_matches(matched_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_matches_dedup ON user_matches(dedup_key);

ALTER TABLE user_matches ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_matches' AND policyname = 'Service role full access on user_matches') THEN
    CREATE POLICY "Service role full access on user_matches" ON user_matches FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;


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
);

ALTER TABLE fetch_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fetch_runs' AND policyname = 'Service role full access on fetch_runs') THEN
    CREATE POLICY "Service role full access on fetch_runs" ON fetch_runs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
