BEGIN;

-- Data-quality checks that need the network (lib/quality/run.ts), and the
-- score history behind the trend on /data/quality.
--
-- One row per thing looked at, overwritten by each later look: a source URL
-- (kind 'link', key = the URL), a quote on its page ('quote'), a ticker
-- against the SEC file ('sec') or OpenFIGI ('figi'), a USGS table row against
-- its chapter PDF ('usgs-pdf'). `ok` is null when the look could not tell —
-- a publisher refusing robots, a PDF that could not be read — which is
-- reported apart and never counted as a failure.
CREATE TABLE IF NOT EXISTS research_quality_checks (
  kind text NOT NULL,
  key text NOT NULL,
  ok boolean,
  status text NOT NULL,
  detail text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  checked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, key)
);
CREATE INDEX IF NOT EXISTS research_quality_checks_age ON research_quality_checks (kind, checked_at);

-- One row per scheduled run. `scores` is the whole scorecard at the end of the
-- run, [{dataset, criterion, checked, passed}], so the trend is what the page
-- showed then, not a recomputation.
CREATE TABLE IF NOT EXISTS research_quality_runs (
  id bigserial PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  looked integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  scores jsonb NOT NULL DEFAULT '[]'
);

COMMENT ON TABLE research_quality_checks IS 'Last network verdict per source URL, quote, ticker and USGS row (lib/quality/run.ts); null ok = could not tell.';
COMMENT ON TABLE research_quality_runs IS 'Data-quality runs and the per-dataset, per-criterion scorecard at the end of each.';

COMMIT;
