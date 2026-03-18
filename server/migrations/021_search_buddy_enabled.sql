ALTER TABLE user_profile_data ADD COLUMN IF NOT EXISTS search_buddy_enabled BOOLEAN DEFAULT FALSE;
UPDATE user_profile_data SET search_buddy_enabled = FALSE WHERE search_buddy_enabled IS NULL;
