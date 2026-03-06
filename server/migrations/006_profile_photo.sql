-- Add profile_photo_url column to user_profile_data
-- Run in Supabase SQL editor
ALTER TABLE user_profile_data ADD COLUMN IF NOT EXISTS profile_photo_url text DEFAULT NULL;
