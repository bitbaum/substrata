BEGIN;

-- Official statistics fetched on a schedule (lib/series-store.ts): one row per
-- (series, period), as the agency published it. Series ids are defined in
-- config/substrata-official-series.ts. Revisions overwrite the value and bump
-- updated_at; first_seen is when the period first reached us, which is what
-- makes a point "new" on a reader's desk.
CREATE TABLE IF NOT EXISTS research_series_points (
  series text NOT NULL,
  period text NOT NULL,
  value double precision NOT NULL,
  preliminary boolean NOT NULL DEFAULT false,
  first_seen timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (series, period)
);
CREATE INDEX IF NOT EXISTS research_series_points_first_seen ON research_series_points (first_seen DESC);

CREATE TABLE IF NOT EXISTS research_series_runs (
  id bigserial PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  series integer NOT NULL DEFAULT 0,
  points_new integer NOT NULL DEFAULT 0,
  points_revised integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0
);

COMMENT ON TABLE research_series_points IS 'Official statistical series (BLS producer price indexes) mapped to bottlenecks; shown as published.';

COMMIT;
