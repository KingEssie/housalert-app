-- Add geocoding columns to search_profiles
-- Run this in Supabase SQL Editor

ALTER TABLE search_profiles
  ADD COLUMN IF NOT EXISTS city_name text,
  ADD COLUMN IF NOT EXISTS country_code text DEFAULT 'DE',
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS place_id text;

-- Backfill existing rows: copy city → city_name where city_name is null
UPDATE search_profiles
  SET city_name = city
  WHERE city_name IS NULL AND city IS NOT NULL;
