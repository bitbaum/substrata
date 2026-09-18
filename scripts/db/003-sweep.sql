BEGIN;

-- Candidates the scheduled sweep finds. NOT the corpus.
--
-- The corpus stays file-SSOT in git, accepted by a person in a commit, because
-- that is the whole claim of the site. A timer writing straight into it would
-- publish unread rows, and a release directory is replaced on every deploy
-- anyway. So the sweep lands here: a queue of leads a reviewer can promote.
CREATE TABLE IF NOT EXISTS research_sweep_candidates (
  id text PRIMARY KEY,
  bottleneck text NOT NULL,
  term text NOT NULL,
  url text NOT NULL,
  title text NOT NULL,
  published text,
  excerpt text NOT NULL,
  effect_guess text NOT NULL,
  found_at timestamptz NOT NULL DEFAULT now(),
  -- Set when a person has decided. Nothing here reaches a page until then.
  reviewed_at timestamptz,
  reviewed_by text,
  verdict text CHECK (verdict IN ('accepted', 'rejected'))
);
CREATE INDEX IF NOT EXISTS research_sweep_candidates_open
  ON research_sweep_candidates (found_at DESC) WHERE reviewed_at IS NULL;

-- When each node was last looked at, so a bounded run can rotate rather than
-- sweeping the same few nodes forever.
CREATE TABLE IF NOT EXISTS research_sweep_state (
  node text PRIMARY KEY,
  last_swept timestamptz NOT NULL DEFAULT now(),
  last_status text NOT NULL
);

-- What the timer actually did, so "how fresh is this" has an answer that is not
-- a guess. A sweep that silently stops looks exactly like a quiet week.
CREATE TABLE IF NOT EXISTS research_sweep_runs (
  id bigserial PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  nodes_swept integer NOT NULL DEFAULT 0,
  candidates_found integer NOT NULL DEFAULT 0,
  could_not_look integer NOT NULL DEFAULT 0
);

COMMENT ON TABLE research_sweep_candidates IS 'Leads from the scheduled sweep. The corpus is git; nothing here is published until a person accepts it.';
COMMENT ON TABLE research_sweep_runs IS 'Evidence that the sweep ran, so staleness is measurable rather than inferred.';

COMMIT;
