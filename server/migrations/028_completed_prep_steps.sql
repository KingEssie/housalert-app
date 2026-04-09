ALTER TABLE user_profile_data
  ADD COLUMN IF NOT EXISTS completed_prep_steps TEXT[] DEFAULT '{}';
