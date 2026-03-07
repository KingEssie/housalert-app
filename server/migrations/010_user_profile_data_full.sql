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
  network_task_done BOOLEAN DEFAULT FALSE,
  viewing_tips_done BOOLEAN DEFAULT FALSE,
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
