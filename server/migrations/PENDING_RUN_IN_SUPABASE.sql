-- =============================================================
-- PENDING MIGRATIONS — Run this entire file in the Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query → paste → Run)
-- All statements are idempotent — safe to re-run.
-- =============================================================

-- -----------------------------------------------
-- Migration 008: listing_freshness & match_timestamps
-- -----------------------------------------------
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

ALTER TABLE listing_freshness ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'listing_freshness' AND policyname = 'Service role full access on listing_freshness') THEN
    CREATE POLICY "Service role full access on listing_freshness"
      ON listing_freshness FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE match_timestamps ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'match_timestamps' AND policyname = 'Service role full access on match_timestamps') THEN
    CREATE POLICY "Service role full access on match_timestamps"
      ON match_timestamps FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

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
-- Migration 011: search_profiles geo columns + city_name backfill
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

-- -----------------------------------------------
-- Migration 014: Unique constraint on matches
-- First remove any existing duplicates (keeps oldest match per combo)
-- -----------------------------------------------
DELETE FROM matches a USING matches b
WHERE a.id > b.id
  AND a.user_id = b.user_id
  AND a.search_profile_id = b.search_profile_id
  AND a.listing_id = b.listing_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_unique
ON matches(user_id, search_profile_id, listing_id);

-- -----------------------------------------------
-- Migration 015: Enforce max 4 search profiles per user
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION check_search_profile_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT count(*) FROM search_profiles WHERE user_id = NEW.user_id) >= 4 THEN
    RAISE EXCEPTION 'Maximum of 4 search profiles per user reached';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_search_profile_limit ON search_profiles;
CREATE TRIGGER enforce_search_profile_limit
  BEFORE INSERT ON search_profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_search_profile_limit();

-- -----------------------------------------------
-- Migration 016: New search-profile filter columns
-- -----------------------------------------------
ALTER TABLE search_profiles ADD COLUMN IF NOT EXISTS furnished TEXT;
ALTER TABLE search_profiles ADD COLUMN IF NOT EXISTS property_types TEXT[];
ALTER TABLE search_profiles ADD COLUMN IF NOT EXISTS extra_features TEXT[];

-- -----------------------------------------------
-- Migration 017: target_categories column
-- -----------------------------------------------
ALTER TABLE search_profiles ADD COLUMN IF NOT EXISTS target_categories TEXT[];

-- -----------------------------------------------
-- Migration 015: Advanced filter columns on listings
-- -----------------------------------------------
-- NOTE: furnished is now decoupled from other advanced columns in the code.
-- You can run JUST the furnished lines (migration 016) to enable furnished filtering,
-- OR run the full migration 015 to enable all advanced columns at once.
-- All statements are idempotent — safe to run both.

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

-- -----------------------------------------------
-- Migration 018: Push notification infrastructure
-- -----------------------------------------------
ALTER TABLE user_notification_settings
  ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'push_subscriptions' AND policyname = 'Service role full access on push_subscriptions') THEN
    CREATE POLICY "Service role full access on push_subscriptions"
      ON push_subscriptions FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS push_sent_log (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_push_sent_log_user_listing ON push_sent_log(user_id, listing_id);

ALTER TABLE push_sent_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'push_sent_log' AND policyname = 'Service role full access on push_sent_log') THEN
    CREATE POLICY "Service role full access on push_sent_log"
      ON push_sent_log FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- -----------------------------------------------
-- Migration 024: Optional feature columns on listings
-- -----------------------------------------------
ALTER TABLE listings ADD COLUMN IF NOT EXISTS garden BOOLEAN DEFAULT NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS bath BOOLEAN DEFAULT NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS roof_terrace BOOLEAN DEFAULT NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS energy_label TEXT DEFAULT NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS property_type TEXT DEFAULT NULL;

-- -----------------------------------------------
-- Migration 025: Parking column on listings
-- -----------------------------------------------
ALTER TABLE listings ADD COLUMN IF NOT EXISTS parking BOOLEAN DEFAULT NULL;

-- -----------------------------------------------
-- Migration 026: Coordinate metadata columns on listings
-- -----------------------------------------------
ALTER TABLE listings ADD COLUMN IF NOT EXISTS coordinate_source TEXT DEFAULT NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS coordinate_precision TEXT DEFAULT NULL;

-- -----------------------------------------------
-- Migration 027: Geocode cache table
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS geocode_cache (
  cache_key TEXT PRIMARY KEY,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE geocode_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'geocode_cache' AND policyname = 'Service role full access on geocode_cache') THEN
    CREATE POLICY "Service role full access on geocode_cache"
      ON geocode_cache FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;
