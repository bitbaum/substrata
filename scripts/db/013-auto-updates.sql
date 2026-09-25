BEGIN;

-- Automatic AI updates, spent on the READER's own key (lib/auto-updates.ts).
--
-- A reader who opts in at /account/settings#auto-updates lets the hourly run
-- draft new leads on their bottlenecks with the key they saved. This ledger is
-- how the run keeps to the daily cap they chose: one row per reader per UTC
-- day, counting the leads that reached their model. The site's free models
-- never draft; there is no row here for them.
CREATE TABLE IF NOT EXISTS research_auto_draft_days (
  actor_id text NOT NULL,
  day date NOT NULL,
  drafts integer NOT NULL DEFAULT 0,
  PRIMARY KEY (actor_id, day)
);

COMMENT ON TABLE research_auto_draft_days IS 'Per-reader daily count of automatic drafts made on that reader''s own AI key, against the cap they set.';

COMMIT;
