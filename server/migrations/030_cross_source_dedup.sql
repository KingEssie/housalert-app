-- ============================================================
-- Migration 030: Cross-source deduplication — listing_cluster_id
-- ============================================================
-- MANUAL RUN REQUIRED:
--   Execute this in the Supabase SQL Editor.
--   Do NOT run via npx prisma db push (Supabase DDL access only).
--
-- Purpose:
--   listing_cluster_id groups listings that represent the same
--   physical apartment posted across multiple sources (e.g. the same
--   flat appears on Kleinanzeigen AND Immowelt). Having a shared UUID
--   lets the UI and matching engine deduplicate cross-source results
--   for users and suppress duplicate notifications in future phases.
--
--   Phase 1: The column is populated by the ingestion pipeline after
--   each new listing insert. Clustering logic: same city + same bedrooms
--   + price within ±8% + size within ±15% + different source + inserted
--   within the last 7 days. If a match is found, the new listing joins
--   that cluster. If not, a new UUID cluster is created.
--
--   Phase 2 (future): The matching engine will use cluster_id to
--   suppress duplicate notifications when the same apartment matches
--   a user's profile from two sources.
-- ============================================================

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS listing_cluster_id UUID;

-- Index for cluster-based lookups (join all members of a cluster)
CREATE INDEX IF NOT EXISTS idx_listings_cluster_id
  ON listings (listing_cluster_id)
  WHERE listing_cluster_id IS NOT NULL;

-- Composite index for the cross-source cluster-match query
-- (city + bedrooms + price range scan, covering source for filter)
CREATE INDEX IF NOT EXISTS idx_listings_cross_source_lookup
  ON listings (city, bedrooms, price)
  WHERE price > 0 AND bedrooms > 0;
