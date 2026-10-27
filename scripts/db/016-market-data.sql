BEGIN;

-- Market data (lib/market-data). Additive and idempotent, like every file here;
-- apply with scripts/provision-service.py before /api/cron/prices reaches
-- production (docs/INFRASTRUCTURE.md, "Market data").

-- Daily closes, one row per listing, source and trading day. `close` is the
-- source's split-adjusted close (dividends not added back); the basis is
-- stated with every figure in lib/market-data/prices/series.ts. A split
-- re-adjusts history at the source, so the fetch overwrites and bumps
-- updated_at; first_seen keeps when the day first reached us.
CREATE TABLE IF NOT EXISTS research_price_points (
  exchange text NOT NULL,
  symbol text NOT NULL,
  source text NOT NULL,
  day date NOT NULL,
  close double precision NOT NULL CHECK (close > 0),
  currency text NOT NULL,
  first_seen timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (exchange, symbol, source, day)
);

CREATE TABLE IF NOT EXISTS research_price_runs (
  id bigserial PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  tickers integer NOT NULL DEFAULT 0,
  points_new integer NOT NULL DEFAULT 0,
  points_revised integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0
);

-- Fundamentals and holders read from SEC EDGAR, as computed snapshots (the
-- shapes in lib/market-data/fundamentals and lib/market-data/holders), keyed
-- by kind and CIK. Every figure inside carries its own filing URL and date;
-- the row only says when it was read.
CREATE TABLE IF NOT EXISTS research_market_snapshots (
  kind text NOT NULL CHECK (kind IN ('fundamentals', 'holders')),
  key text NOT NULL,
  data jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, key)
);

CREATE TABLE IF NOT EXISTS research_market_fact_runs (
  id bigserial PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  looked integer NOT NULL DEFAULT 0,
  stored integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0
);

COMMENT ON TABLE research_price_points IS 'Delayed end-of-day closes for listed companies (lib/market-data/prices); not redistributed.';
COMMENT ON TABLE research_market_snapshots IS 'SEC XBRL fundamentals and filing-based holders per CIK (lib/market-data).';

COMMIT;
