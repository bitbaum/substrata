BEGIN;

-- Model spend on this app's free keys, per UTC day and per class: 'interactive'
-- (a reader waiting on Ask) and 'background' (scheduled jobs such as event
-- drafting). Background may only spend from a capped slice and never below the
-- floor kept for readers (lib/ai-budget.ts). Tokens are the vendor's count when
-- it reports one, otherwise a characters/4 estimate.
CREATE TABLE IF NOT EXISTS research_ai_spend (
  day date NOT NULL,
  class text NOT NULL,
  tokens bigint NOT NULL DEFAULT 0,
  calls integer NOT NULL DEFAULT 0,
  held integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, class)
);

COMMENT ON TABLE research_ai_spend IS 'Per-day AI token spend by class (interactive/background) on the shared free keys; held = background calls refused to protect readers.';

COMMIT;
