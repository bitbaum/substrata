BEGIN;

-- A signed-in reader's own AI key, sealed (AES-256-GCM, @bitbaum/ai-kit/seal)
-- with SUBSTRATA_BYOK_SECRET. The database alone cannot read it. One key per
-- reader: the vendor and model they chose, and the last four characters so
-- the settings page can say which key is saved without ever showing it.
CREATE TABLE IF NOT EXISTS research_ai_keys (
  actor_id text PRIMARY KEY,
  vendor text NOT NULL,
  model text NOT NULL,
  sealed text NOT NULL,
  key_hint text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE research_ai_keys IS 'Per-reader BYOK key for Ask, sealed with SUBSTRATA_BYOK_SECRET. Private to the reader.';

COMMIT;
