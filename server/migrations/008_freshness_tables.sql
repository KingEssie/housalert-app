-- Migration: Create listing_freshness and match_timestamps tables in Supabase
-- These were previously in local Postgres and are now moved to Supabase.

CREATE TABLE IF NOT EXISTS listing_freshness (
  listing_id UUID PRIMARY KEY,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_freshness_first_seen
  ON listing_freshness (first_seen_at DESC);

CREATE TABLE IF NOT EXISTS match_timestamps (
  match_id UUID PRIMARY KEY,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RPC function for atomic upsert: inserts new row or updates only last_seen_at on conflict
CREATE OR REPLACE FUNCTION upsert_listing_freshness(
  p_listing_id UUID,
  p_source TEXT,
  p_source_id TEXT,
  p_now TIMESTAMPTZ
) RETURNS VOID AS $$
BEGIN
  INSERT INTO listing_freshness (listing_id, source, source_id, first_seen_at, last_seen_at)
  VALUES (p_listing_id, p_source, p_source_id, p_now, p_now)
  ON CONFLICT (listing_id) DO UPDATE SET last_seen_at = p_now;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Disable RLS on freshness tables (server-only via service_role key)
ALTER TABLE listing_freshness ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on listing_freshness"
  ON listing_freshness FOR ALL
  USING (true) WITH CHECK (true);

ALTER TABLE match_timestamps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on match_timestamps"
  ON match_timestamps FOR ALL
  USING (true) WITH CHECK (true);
