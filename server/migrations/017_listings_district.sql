-- Migration 017: Add district column to listings table (phase 2 of advanced filters)
-- Run this in Supabase SQL Editor

ALTER TABLE listings ADD COLUMN IF NOT EXISTS district TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_district ON listings (district) WHERE district IS NOT NULL;
