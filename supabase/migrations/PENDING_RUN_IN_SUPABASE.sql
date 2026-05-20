-- PENDING: Run this manually in the Supabase SQL Editor.
-- Adds source_published_at to listings so HousAlert can track when a listing was
-- actually posted on the source site (e.g. Kleinanzeigen), distinct from
-- first_seen_at (when HousAlert first detected it).
-- This powers:
--   1. Correct freshness labels ("3 min geleden" = posted 3 min ago on KA)
--   2. Alert freshness gate (no email/push for listings older than 2h on source)

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS source_published_at TIMESTAMPTZ;

-- Optional index for future freshness queries
CREATE INDEX IF NOT EXISTS idx_listings_source_published_at
  ON listings (source_published_at)
  WHERE source_published_at IS NOT NULL;
