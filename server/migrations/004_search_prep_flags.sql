ALTER TABLE user_profile_data
  ADD COLUMN IF NOT EXISTS network_task_done BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS viewing_tips_done BOOLEAN DEFAULT false;
