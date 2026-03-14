-- Migration 020: Add status tracking to listing_freshness table
-- Run this in the Supabase SQL Editor

ALTER TABLE listing_freshness
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_listing_freshness_status
  ON listing_freshness (status);

CREATE INDEX IF NOT EXISTS idx_listing_freshness_last_seen
  ON listing_freshness (last_seen_at DESC);

COMMENT ON COLUMN listing_freshness.status IS 'active, stale, or removed — computed by staleness checker';
COMMENT ON COLUMN listing_freshness.status_changed_at IS 'When the status last changed';
