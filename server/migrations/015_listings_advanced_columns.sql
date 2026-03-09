-- Migration 015: Add advanced filter columns to listings table
-- These columns support matching against search profile advanced filters

ALTER TABLE listings ADD COLUMN IF NOT EXISTS furnished BOOLEAN DEFAULT NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS pets_allowed BOOLEAN DEFAULT NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS balcony BOOLEAN DEFAULT NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS elevator BOOLEAN DEFAULT NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS district TEXT DEFAULT NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION DEFAULT NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION DEFAULT NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS extra_features TEXT[] DEFAULT NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS target_categories TEXT[] DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_furnished ON listings (furnished) WHERE furnished IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listings_pets_allowed ON listings (pets_allowed) WHERE pets_allowed IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listings_district ON listings (district) WHERE district IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listings_lat_lng ON listings (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
