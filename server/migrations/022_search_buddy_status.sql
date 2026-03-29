ALTER TABLE user_profile_data ADD COLUMN IF NOT EXISTS search_buddy_status TEXT DEFAULT 'removed';
ALTER TABLE user_profile_data ADD COLUMN IF NOT EXISTS search_buddy_removed_at TIMESTAMPTZ;

UPDATE user_profile_data
SET search_buddy_status = 'active'
WHERE search_buddy_email IS NOT NULL
  AND search_buddy_email != ''
  AND search_buddy_enabled = TRUE;

UPDATE user_profile_data
SET search_buddy_status = 'removed',
    search_buddy_removed_at = NOW()
WHERE search_buddy_status != 'active';
