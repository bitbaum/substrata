# The data layer of a deploy

Nobody needs a root shell for routine database or timer work. The deploy does it.

```
merge to main → CI green → deploy.yml
  1. data-layer   wait for CI → migrate (scripts/db/*.sql) → timers (deploy/systemd/*)
  2. deploy       the fleet's shared pipeline (build, swap, health check, rollback)
  3. backfill     once ever, after the release is live; cannot fail the deploy
```

`.github/workflows/deploy.yml` wires it; `scripts/ops/data-layer.ts` is the
command (`migrate | timers | backfill`, each with `--dry-run`). The shared
pipeline in `bitbaum/loki` (`selfhost-deploy.yml`) is unchanged; its schema step
sees no `drizzle/`, `prisma/` or `supabase/` directory in this repo and applies
nothing, which is why this repo carries its own.

## How it reaches the box

Over ssh as `ubuntu` with the fleet's deploy key, the same door the shared
pipeline uses. `ubuntu` has passwordless sudo on the box (the fleet's own deploy
scripts rely on it); the steps use it for
exactly `sudo -u postgres psql -d substrata` (migrations), and
`sudo tee`/`chmod` into `/etc/systemd/system`, `sudo systemctl daemon-reload` and
`sudo systemctl enable --now <timer>` (timers), all with fixed arguments built in
`scripts/ops/box.ts` and `scripts/ops/timers.ts`. No sudoers entry was added.
SQL and unit files travel on stdin, never in a command line or a log.

## Migrations

- A migration is `scripts/db/NNN-name.sql` (three digits, lower-case, `.sql`),
  applied in filename order. `seed-development-profile.sql` is not one.
- The ledger is `public.schema_migrations (filename, applied_at, how)`.
  `how` is `applied` (the deploy ran it) or `baseline` (recorded as already
  there, see below).
- Each pending file runs in ONE transaction with its ledger row, as the app role
  (so the app owns what is created), with a 15 second lock timeout and an
  advisory lock. Standalone `BEGIN;`/`COMMIT;` lines in a file are dropped
  because the runner owns the transaction. The first failure rolls back that
  file, stops everything after it, and fails the `data-layer` job; `deploy`
  then never starts, so the live release and the live schema are as they were.
- Write files that are safe to run twice: `CREATE TABLE IF NOT EXISTS`,
  `CREATE INDEX IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `INSERT … ON
  CONFLICT`, no `DROP`/`TRUNCATE`/`DELETE`, no `$$` bodies.
  `test/data-layer.test.ts` fails a file that is not.
- Migrations run before the new code, so they must be additive: the release
  that is still serving has to work against the new schema.

### First run on a database that already has some of these tables

The ledger did not exist before this chain, and 001 (by `provision-service.py`)
and possibly others were applied by hand. With no ledger, each file is checked
against the live database: when every table, index and added column it declares
exists, it is recorded as `baseline` without running; otherwise it runs (safe,
because files are idempotent), and the plan says what was missing. Tables from
these files that the app role does not own (applied by hand as `postgres`) are
handed to the app role first, so a later re-run cannot die on "must be owner".
`migrate --dry-run` prints all of this and changes nothing:

```
  baseline 001-research-service.sql (every declared object exists)
  apply    016-market-data.sql (missing: table research_price_points, …)
```

### Adding a migration

1. Add a new numbered .sql file under `scripts/db/` (next number, short name), idempotent and additive.
2. `pnpm run verify` (it includes the idempotence rule and, when
   `SUBSTRATA_TEST_PG_URL` points at a scratch PostgreSQL, the runner test).
3. Merge. The deploy applies it before the release.

Never edit a file once it has been applied; add a new one.

### Rolling back

Migrations are forward-only. If one is wrong, add the next number that fixes it.
If the deploy stopped on a failed migration there is nothing to roll back: the
file was rolled back, the site is on the previous release, fix the file and
merge again. To ship code while a migration problem is investigated, set the
repository variable `SUBSTRATA_SKIP_DATA_LAYER=1` (GitHub: Settings, Secrets and
variables, Actions, Variables) and re-run Deploy; remove it afterwards. Skipped
runs print a warning and apply neither migrations nor timers.

## Timers

`deploy/systemd/` holds the units this app owns, as plain files; the repo is the
source of truth. Today: `appcron-substrata-prices.service` and `.timer`, daily
at 22:07 UTC, calling `POST /api/cron/prices` through `/opt/_appcron/run.sh`
(which reads `CRON_SECRET` from the app's env on the box). Every deploy writes
the files that differ, reloads systemd once if anything changed, and runs
`enable --now` on every timer, so a timer someone stopped comes back. It prints
`systemctl list-timers` for each, which is where the next-run time shows.

The repo can write root-owned files this way, so `scripts/ops/timers.ts` accepts
only the shape of an appcron unit: name `appcron-substrata-<job>.service|timer`,
a fixed set of keys, `Type=oneshot`, and an `ExecStart` that can only be
`/opt/_appcron/run.sh substrata 4022 /api/cron/<job> GET|POST`. Anything else
fails the job before a byte is written, and a timer needs its service beside it.

The other `appcron-substrata-*` timers (sweep, filings, auto-updates, science,
series, jobs, source, quality) are still installed from Loki's registry in
bitbaum/loki's `install-app-crons.sh`; a unit file here with the same name
replaces that one. To add a timer: copy the prices pair, change the job, route
and schedule, merge.

## Backfill, once

After the release is live, the `backfill` job asks the database whether
`market-data-backfill` is in `public.schema_oneshots`. If not, it opens an ssh
tunnel to the box's PostgreSQL, runs `pnpm exec tsx
scripts/research/market-data.ts --backfill` for at most 40 minutes, and records
the name only when the command exits 0 and `research_price_points` has rows. It
is `continue-on-error`: a failure, or a source refusing a GitHub runner, leaves
the deploy green and the backfill unrecorded, so the next deploy tries again;
the daily timer fills prices regardless. The database URL is read from the box
env inside the job and masked; it is never printed.

## Looking at what happened

- Deploy run, job `data layer`: the plan, one line per file
  (`applied … and recorded it in one transaction`), the units written, and the
  `systemctl list-timers` line with the next run.
- Database: `SELECT filename, how, applied_at FROM public.schema_migrations
  ORDER BY 1;` and `SELECT * FROM public.schema_oneshots;`.
- Box: `systemctl list-timers 'appcron-substrata-*'`.
