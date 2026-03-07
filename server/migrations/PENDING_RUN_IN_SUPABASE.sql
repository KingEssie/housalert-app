-- =============================================================
-- PENDING MIGRATIONS — Run this entire file in the Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query → paste → Run)
-- =============================================================

-- -----------------------------------------------
-- Migration 008: listing_freshness & match_timestamps
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS listing_freshness (
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (source, source_id)
);

CREATE TABLE IF NOT EXISTS match_timestamps (
  user_id UUID NOT NULL,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  matched_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

-- -----------------------------------------------
-- Migration 010: user_profile_data
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS user_profile_data (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  search_buddy_email TEXT,
  application_template TEXT,
  document_checklist JSONB DEFAULT '{}',
  first_name TEXT,
  last_name TEXT,
  birth_date TEXT,
  phone TEXT,
  bio TEXT,
  profile_photo_url TEXT,
  occupation TEXT,
  monthly_income INTEGER,
  network_task_done BOOLEAN DEFAULT false,
  viewing_tips_done BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_profile_data ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profile_data' AND policyname = 'Users can read own profile data') THEN
    CREATE POLICY "Users can read own profile data" ON user_profile_data FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profile_data' AND policyname = 'Users can insert own profile data') THEN
    CREATE POLICY "Users can insert own profile data" ON user_profile_data FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profile_data' AND policyname = 'Users can update own profile data') THEN
    CREATE POLICY "Users can update own profile data" ON user_profile_data FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profile_data' AND policyname = 'Service role bypass') THEN
    CREATE POLICY "Service role bypass" ON user_profile_data FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- -----------------------------------------------
-- Migration 011: search_profiles geo columns
-- -----------------------------------------------
ALTER TABLE search_profiles
  ADD COLUMN IF NOT EXISTS city_name TEXT,
  ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'DE',
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS place_id TEXT;

UPDATE search_profiles
  SET city_name = city
  WHERE city_name IS NULL AND city IS NOT NULL;

-- -----------------------------------------------
-- Migration 012: location mode columns
-- -----------------------------------------------
ALTER TABLE search_profiles
  ADD COLUMN IF NOT EXISTS location_mode TEXT DEFAULT 'city',
  ADD COLUMN IF NOT EXISTS districts TEXT[],
  ADD COLUMN IF NOT EXISTS radius_km INTEGER,
  ADD COLUMN IF NOT EXISTS commute_destination TEXT,
  ADD COLUMN IF NOT EXISTS commute_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS commute_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS commute_mode TEXT,
  ADD COLUMN IF NOT EXISTS commute_minutes INTEGER;

-- -----------------------------------------------
-- Migration 013: onboarding_drafts table
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS onboarding_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL DEFAULT 'DE',
  city_name TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  place_id TEXT,
  location_mode TEXT DEFAULT 'city',
  districts TEXT[],
  radius_km INTEGER,
  commute_destination TEXT,
  commute_lat DOUBLE PRECISION,
  commute_lng DOUBLE PRECISION,
  commute_mode TEXT,
  commute_minutes INTEGER,
  price_min INTEGER DEFAULT 0,
  price_max INTEGER DEFAULT 0,
  property_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  claimed_by UUID,
  claimed_at TIMESTAMPTZ
);
