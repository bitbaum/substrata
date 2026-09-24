BEGIN;

-- The science pipeline's feed queue: papers, preprints and grants collected
-- per bottleneck from OpenAlex, arXiv, NSF, OpenAIRE and USAspending (DOE).
-- Machine-collected and machine-placed on a stage: every row is unreviewed
-- until `review` says otherwise, and pages say so. One row per (bottleneck,
-- work), keyed by the work's normalised title so the arXiv preprint and its
-- journal version are one row; the other copy's link is kept in also_urls.
CREATE TABLE IF NOT EXISTS research_science_items (
  bottleneck text NOT NULL,
  title_key text NOT NULL,
  id text NOT NULL,
  source text NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  abstract text NOT NULL DEFAULT '',
  venue text,
  year integer,
  published_on date,
  url text NOT NULL,
  doi text,
  pdf_url text,
  citations integer,
  institutions jsonb NOT NULL DEFAULT '[]',
  funder text,
  programme text,
  amount numeric,
  currency text,
  score integer NOT NULL,
  matched text[] NOT NULL DEFAULT '{}',
  stage text NOT NULL,
  stage_why text NOT NULL,
  also_urls text[] NOT NULL DEFAULT '{}',
  review text NOT NULL DEFAULT 'unreviewed',
  first_seen timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bottleneck, title_key)
);
CREATE INDEX IF NOT EXISTS research_science_items_published ON research_science_items (published_on DESC);
CREATE INDEX IF NOT EXISTS research_science_items_first_seen ON research_science_items (first_seen DESC);

CREATE TABLE IF NOT EXISTS research_science_runs (
  id bigserial PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  bottlenecks text[] NOT NULL DEFAULT '{}',
  fetched integer NOT NULL DEFAULT 0,
  kept integer NOT NULL DEFAULT 0,
  items_new integer NOT NULL DEFAULT 0,
  failed text[] NOT NULL DEFAULT '{}'
);

-- When each bottleneck was last searched, so a run takes the stalest first.
CREATE TABLE IF NOT EXISTS research_science_cursor (
  bottleneck text PRIMARY KEY,
  searched_at timestamptz NOT NULL
);

COMMENT ON TABLE research_science_items IS 'Science pipeline feed: papers, preprints, grants per bottleneck (OpenAlex, arXiv, NSF, OpenAIRE, USAspending). Unreviewed.';

COMMIT;
