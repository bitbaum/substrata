BEGIN;

-- AI drafts of events, one per sweep lead. NOT the corpus.
--
-- A model reads the lead's page and proposes a CoverageEvent row; the code
-- (lib/event-draft.ts) refuses any draft whose quote is not on the page word
-- for word. A reviewer then edits and accepts or rejects it at /review. Even an
-- accepted draft is not published: it waits in `accepted_event` until
-- `pnpm run research:accept-events` writes it into the corpus file and a
-- person commits it. See docs/INFRASTRUCTURE.md, "From lead to event".
CREATE TABLE IF NOT EXISTS research_event_drafts (
  candidate_id text PRIMARY KEY REFERENCES research_sweep_candidates (id) ON DELETE CASCADE,
  -- drafted: the model answered and the checks passed (it may still say "not an event").
  -- unusable: the model answered but its quote was not on the page, twice.
  -- could_not_read: the page could not be fetched.
  -- duplicate: the page is already the source of an accepted event.
  status text NOT NULL CHECK (status IN ('drafted', 'unusable', 'could_not_read', 'duplicate')),
  suggestion text CHECK (suggestion IN ('event', 'not_an_event')),
  reason text NOT NULL DEFAULT '',
  -- CoverageEvent minus acceptedOn; null when the suggestion is "not an event".
  draft jsonb,
  notes text[] NOT NULL DEFAULT '{}',
  -- The text the quote was verified against, kept so an edited quote can be
  -- re-verified at accept time without fetching the page again.
  page_text text,
  model text,
  attempts integer NOT NULL DEFAULT 1,
  drafted_at timestamptz NOT NULL DEFAULT now(),
  -- What the reviewer accepted, possibly edited, as a full CoverageEvent.
  accepted_event jsonb,
  accepted_at timestamptz,
  accepted_by text
);
CREATE INDEX IF NOT EXISTS research_event_drafts_accepted
  ON research_event_drafts (accepted_at) WHERE accepted_event IS NOT NULL;

-- What each drafting run did, so "is the drafter still working" has an answer.
CREATE TABLE IF NOT EXISTS research_event_draft_runs (
  id bigserial PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  drafted integer NOT NULL DEFAULT 0,
  unusable integer NOT NULL DEFAULT 0,
  could_not_read integer NOT NULL DEFAULT 0,
  -- Why the run ended early, if it did: the model budget ran out, or time did.
  stopped text
);

COMMENT ON TABLE research_event_drafts IS 'AI drafts of events from sweep leads. Nothing here is published; an accepted draft reaches a page only through a commit.';

COMMIT;
