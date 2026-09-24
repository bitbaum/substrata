BEGIN;

-- What a reader has done with a row on their desk: read it, saved it, hidden
-- it. Keyed by 'event:<id>' or 'lead:<id>', so both kinds of row share one
-- table and a lead that later becomes an event keeps nothing it should not.
CREATE TABLE IF NOT EXISTS research_desk_marks (
  actor_id text NOT NULL,
  item_key text NOT NULL,
  state text NOT NULL CHECK (state IN ('read', 'saved', 'hidden')),
  marked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, item_key, state)
);

-- How the scheduled sweep behaves, editable by a reviewer from the desk
-- rather than by a deploy. One row. An absent key means the code's default.
CREATE TABLE IF NOT EXISTS research_sweep_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

COMMENT ON TABLE research_desk_marks IS 'Per-reader read/saved/hidden marks on desk rows. Private to the reader.';
COMMENT ON TABLE research_sweep_settings IS 'Operator settings for the scheduled sweep: cadence, batch size, extra blocked hosts and event words.';

COMMIT;
