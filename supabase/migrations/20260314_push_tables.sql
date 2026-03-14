CREATE TABLE IF NOT EXISTS expo_push_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  expo_push_token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'ios',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, expo_push_token)
);

CREATE INDEX IF NOT EXISTS idx_expo_push_tokens_user_id ON expo_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_expo_push_tokens_active ON expo_push_tokens(is_active) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS push_delivery_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  channel TEXT NOT NULL DEFAULT 'expo',
  token_snippet TEXT,
  full_token TEXT,
  listing_ids TEXT[],
  listing_count INT NOT NULL DEFAULT 0,
  title TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  expo_ticket_id TEXT,
  expo_receipt_status TEXT,
  error_type TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_delivery_log_user ON push_delivery_log(user_id);
CREATE INDEX IF NOT EXISTS idx_push_delivery_log_created ON push_delivery_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_delivery_log_ticket ON push_delivery_log(expo_ticket_id) WHERE expo_ticket_id IS NOT NULL;

ALTER TABLE expo_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_delivery_log ENABLE ROW LEVEL SECURITY;
