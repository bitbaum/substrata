BEGIN;

-- Candidates the scheduled producer-sourcing run finds. NOT the corpus.
--
-- Same reasoning as `research_sweep_candidates` (003-sweep.sql): the corpus
-- stays file-SSOT in git, accepted by a person in a commit, because that is
-- the whole claim of the site. A timer writing straight into
-- `config/substrata-coverage.ts` would publish unread rows, and the box runs
-- releases rather than checkouts anyway — there is no working tree at
-- runtime to commit a promotion into. So the scheduled run lands here: a
-- queue of candidate pages a reviewer can read and, if they hold up, use to
-- promote a `lead()` to a `sourced()` by hand.
CREATE TABLE IF NOT EXISTS research_source_candidates (
  -- sha1(material || producer || url), so the same page found on a later run
  -- for the same row is the same id rather than a duplicate.
  id text PRIMARY KEY,
  material text NOT NULL,
  producer text NOT NULL,
  query text NOT NULL,
  url text NOT NULL,
  title text NOT NULL,
  excerpt text NOT NULL,
  -- Company-name and material terms the page matched on, comma-joined —
  -- carried through so a reviewer sees why the engine kept this page without
  -- needing to re-read it themselves.
  matched text NOT NULL,
  found_at timestamptz NOT NULL DEFAULT now(),
  -- Set when a person has decided. Nothing here reaches the coverage file
  -- until then, and accepting a row here does not write it — see the header.
  reviewed_at timestamptz,
  reviewed_by text,
  verdict text CHECK (verdict IN ('accepted', 'rejected'))
);
CREATE INDEX IF NOT EXISTS research_source_candidates_open
  ON research_source_candidates (found_at DESC) WHERE reviewed_at IS NULL;

-- When each unsourced row was last looked at, so a bounded run rotates
-- through the queue rather than examining the same few rows every time.
CREATE TABLE IF NOT EXISTS research_source_state (
  -- evidenceKey(material, producer) — "<material> :: <producer>".
  row_key text PRIMARY KEY,
  last_checked timestamptz NOT NULL DEFAULT now(),
  last_status text NOT NULL
);

-- What the timer actually did, so "is the engine still running" has an
-- answer that is not a guess.
CREATE TABLE IF NOT EXISTS research_source_runs (
  id bigserial PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  rows_examined integer NOT NULL DEFAULT 0,
  candidates_found integer NOT NULL DEFAULT 0,
  could_not_look integer NOT NULL DEFAULT 0
);

COMMENT ON TABLE research_source_candidates IS 'Candidate producer sources from the scheduled run. The coverage file is git; nothing here is a finding until a person reads it and promotes it by hand.';
COMMENT ON TABLE research_source_runs IS 'Evidence that the producer-sourcing timer ran, so staleness is measurable rather than inferred.';

COMMIT;
