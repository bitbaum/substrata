BEGIN;

-- Open roles at directory companies, read from the public job-board APIs of
-- the applicant-tracking systems they use (Greenhouse, Lever, Ashby), each
-- board verified on the company's own careers page (research/job-boards.json).
-- Only what a posting states and what is derived from it by the published
-- rules is kept: no description text, no salary unless stated, nothing about
-- applicants. A posting that disappears from its board is closed, not deleted,
-- so "new this week" and "open now" can both be answered.
CREATE TABLE IF NOT EXISTS research_jobs (
  id text PRIMARY KEY,
  company_slug text NOT NULL,
  company text NOT NULL,
  title text NOT NULL,
  location text NOT NULL DEFAULT '',
  countries text[] NOT NULL DEFAULT '{}',
  remote boolean NOT NULL DEFAULT false,
  department text NOT NULL DEFAULT '',
  family text NOT NULL,
  seniority text NOT NULL,
  bottlenecks text[] NOT NULL DEFAULT '{}',
  skills text[] NOT NULL DEFAULT '{}',
  posted_at timestamptz,
  url text NOT NULL,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE INDEX IF NOT EXISTS research_jobs_open ON research_jobs (closed_at, first_seen DESC);
CREATE INDEX IF NOT EXISTS research_jobs_company ON research_jobs (company_slug) WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS research_jobs_bottlenecks ON research_jobs USING gin (bottlenecks);

CREATE TABLE IF NOT EXISTS research_job_runs (
  id bigserial PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  boards integer NOT NULL DEFAULT 0,
  seen integer NOT NULL DEFAULT 0,
  jobs_new integer NOT NULL DEFAULT 0,
  closed integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0
);

COMMENT ON TABLE research_jobs IS 'Open roles at directory companies from public Greenhouse/Lever/Ashby boards, filed by lib/careers.ts rules.';

COMMIT;
