CREATE TABLE IF NOT EXISTS source_health (
  id SERIAL PRIMARY KEY,
  source_name TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  last_started_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  duration_ms INTEGER DEFAULT 0,
  found_count INTEGER DEFAULT 0,
  inserted_count INTEGER DEFAULT 0,
  duplicate_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  status TEXT DEFAULT 'unknown',
  consecutive_failures INTEGER DEFAULT 0,
  consecutive_zeros INTEGER DEFAULT 0,
  total_runs INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source_name, city)
);

CREATE TABLE IF NOT EXISTS admin_alerts (
  id SERIAL PRIMARY KEY,
  alert_key TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  source_name TEXT,
  city TEXT,
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  last_notified_at TIMESTAMPTZ,
  notification_count INTEGER DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_alerts_open_key
  ON admin_alerts (alert_key) WHERE status = 'open';
