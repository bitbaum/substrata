BEGIN;

-- What the search backends did in a run, in ai-kit's one line
-- ("searxng unreachable; brave 6"). A run that "could not look" said so as a
-- count; this says which backend failed and how, so /data/freshness can name
-- the cause instead of leaving an operator to guess (2026-11-12: the sweep and
-- producer sourcing failed for a day with nothing but "Failing" to go on).
-- Additive and re-runnable: the release still serving ignores the column.
ALTER TABLE research_sweep_runs ADD COLUMN IF NOT EXISTS search_note text;
ALTER TABLE research_source_runs ADD COLUMN IF NOT EXISTS search_note text;

COMMIT;
