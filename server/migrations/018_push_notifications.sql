-- Add push_enabled to existing notification settings
ALTER TABLE user_notification_settings
  ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT false;

-- Push subscriptions (Web Push API endpoints per user)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'push_subscriptions' AND policyname = 'Service role full access on push_subscriptions') THEN
    CREATE POLICY "Service role full access on push_subscriptions"
      ON push_subscriptions FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Push sent log for deduplication (never send same listing twice to same user)
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
