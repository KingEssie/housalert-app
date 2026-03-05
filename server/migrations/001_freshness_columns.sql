ALTER TABLE listings ADD COLUMN IF NOT EXISTS first_seen_at timestamptz DEFAULT now();
ALTER TABLE listings ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now();
ALTER TABLE matches ADD COLUMN IF NOT EXISTS matched_at timestamptz DEFAULT now();

UPDATE listings SET first_seen_at = created_at, last_seen_at = created_at WHERE first_seen_at IS NULL;
UPDATE matches SET matched_at = created_at WHERE matched_at IS NULL;
