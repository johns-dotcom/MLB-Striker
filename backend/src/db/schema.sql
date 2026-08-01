-- MLB Striker persistence: log every basket "strike" and its per-order outcome.

CREATE TABLE IF NOT EXISTS baskets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  kalshi_env    TEXT NOT NULL,                 -- 'demo' | 'prod'
  order_count   INTEGER NOT NULL,
  status        TEXT NOT NULL,                 -- 'submitted' | 'partial' | 'failed'
  notional_usd  NUMERIC(12,2) NOT NULL DEFAULT 0,
  note          TEXT
);

CREATE TABLE IF NOT EXISTS basket_orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  basket_id        UUID NOT NULL REFERENCES baskets(id) ON DELETE CASCADE,
  client_order_id  TEXT NOT NULL,
  ticker           TEXT NOT NULL,
  action           TEXT NOT NULL,              -- 'buy' | 'sell'
  side             TEXT NOT NULL,              -- 'yes' | 'no'
  order_type       TEXT NOT NULL,              -- 'limit' | 'market'
  count            INTEGER NOT NULL,
  price_cents      INTEGER,                    -- limit price for the chosen side
  kalshi_order_id  TEXT,                       -- filled in on success
  status           TEXT NOT NULL,              -- 'accepted' | 'rejected'
  error            TEXT
);

CREATE INDEX IF NOT EXISTS idx_basket_orders_basket ON basket_orders(basket_id);
CREATE INDEX IF NOT EXISTS idx_baskets_created ON baskets(created_at DESC);

-- Single-row table holding the app login password hash (set from the app's
-- Settings screen). When empty, login falls back to the APP_PASSWORD env var.
CREATE TABLE IF NOT EXISTS app_auth (
  id            INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  password_hash TEXT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
