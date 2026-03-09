-- Migration 016: Add furnished column to listings table (phase 1 of advanced filters)
-- Run this in Supabase SQL Editor

ALTER TABLE listings ADD COLUMN IF NOT EXISTS furnished BOOLEAN DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_furnished ON listings (furnished) WHERE furnished IS NOT NULL;
