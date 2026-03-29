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
