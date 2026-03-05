-- Run this SQL in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)

CREATE TABLE IF NOT EXISTS user_notification_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  phone_e164 text,
  whatsapp_enabled boolean DEFAULT false,
  sms_enabled boolean DEFAULT false,
  email_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification settings"
  ON user_notification_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notification settings"
  ON user_notification_settings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification settings"
  ON user_notification_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access to notification settings"
  ON user_notification_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
