CREATE TABLE IF NOT EXISTS user_profile_data (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  search_buddy_email TEXT,
  application_template TEXT,
  document_checklist JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_profile_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile data"
  ON user_profile_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile data"
  ON user_profile_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile data"
  ON user_profile_data FOR UPDATE
  USING (auth.uid() = user_id);
