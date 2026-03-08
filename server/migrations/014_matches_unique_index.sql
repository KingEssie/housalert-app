DELETE FROM matches a USING matches b
WHERE a.id > b.id
  AND a.user_id = b.user_id
  AND a.search_profile_id = b.search_profile_id
  AND a.listing_id = b.listing_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_unique
ON matches(user_id, search_profile_id, listing_id);
