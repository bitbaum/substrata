BEGIN;

-- How long Ask kept a reader waiting, one row per question. No question text,
-- no reader, no IP: only durations, the number of model calls, how many
-- lookups were planned before them, which link served, and how many links
-- refused on the way. /data shows p50/p90 over the last 24 hours
-- (lib/ask-timing.ts). Rows older than 30 days are pruned on insert.
CREATE TABLE IF NOT EXISTS research_ask_timing (
  at timestamptz NOT NULL DEFAULT now(),
  outcome text NOT NULL,
  first_ms integer,
  total_ms integer NOT NULL,
  model_calls smallint NOT NULL DEFAULT 0,
  planned smallint NOT NULL DEFAULT 0,
  fallbacks smallint NOT NULL DEFAULT 0,
  model text
);

CREATE INDEX IF NOT EXISTS research_ask_timing_at ON research_ask_timing (at);

COMMENT ON TABLE research_ask_timing IS 'Ask latency per question (no question text, no reader): first-text and total ms, model calls, planned lookups, serving link, fallbacks.';

COMMIT;
