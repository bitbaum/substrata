BEGIN;

-- SEC filings by listed holders of a bottleneck, fetched from EDGAR's public
-- submissions API. Primary documents with their own timestamps: unlike sweep
-- leads they need no review to be what they say, but they are still not
-- corpus findings, so they live here rather than in git.
CREATE TABLE IF NOT EXISTS research_filings (
  accession text PRIMARY KEY,
  cik integer NOT NULL,
  company text NOT NULL,
  form text NOT NULL,
  filed_on date NOT NULL,
  accepted_at timestamptz NOT NULL,
  items text[] NOT NULL DEFAULT '{}',
  description text NOT NULL DEFAULT '',
  url text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_filings_cik_accepted ON research_filings (cik, accepted_at DESC);
CREATE INDEX IF NOT EXISTS research_filings_accepted ON research_filings (accepted_at DESC);

CREATE TABLE IF NOT EXISTS research_filing_runs (
  id bigserial PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  registrants integer NOT NULL DEFAULT 0,
  filings_new integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0
);

COMMENT ON TABLE research_filings IS 'SEC filings (8-K, 6-K, 10-K, 10-Q, 20-F, 13D…) by listed bottleneck holders, from EDGAR.';

COMMIT;
