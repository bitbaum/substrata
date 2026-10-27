/**
 * The data layer of a Substrata deploy: migrations, timers, one-shot backfill.
 *
 *   tsx scripts/ops/data-layer.ts migrate  [--dry-run]
 *   tsx scripts/ops/data-layer.ts timers   [--dry-run]
 *   tsx scripts/ops/data-layer.ts backfill [--dry-run]
 *
 * Environment:
 *   BOX                          ubuntu@<host>, where the database and systemd live
 *   SUBSTRATA_PSQL_URL           tests only: use this psql URL instead of the box
 *   SUBSTRATA_BACKFILL_DATABASE_URL  backfill only: the app's URL, tunnelled by the workflow
 *
 * Exit codes: 0 done or nothing to do, 1 failed (the workflow stops the deploy).
 * See docs/operations/data-layer.md.
 */
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { localPsql, sshPsql, sshRemote, type SqlRunner } from './box';
import {
  applyMigrations,
  describePlan,
  migrationNames,
  planMigrations,
  type MigrationFile,
} from './migrations';
import { installUnits, planUnits, validateSet, type UnitFile } from './timers';

const ROOT = path.join(import.meta.dirname, '..', '..');
const DATABASE = 'substrata';
const ROLE = 'substrata';
const BACKFILL = 'market-data-backfill';
const BACKFILL_TIMEOUT_MS = 40 * 60 * 1000;
const log = (line: string) => console.log(line);

function sql(): SqlRunner {
  const url = process.env.SUBSTRATA_PSQL_URL;
  if (url) return localPsql(url);
  const box = process.env.BOX;
  if (!box) throw new Error('BOX (ubuntu@host) is not set');
  return sshPsql(box, DATABASE);
}

function migrationFiles(): MigrationFile[] {
  const dir = path.join(ROOT, 'scripts', 'db');
  return migrationNames(readdirSync(dir)).map((name) => ({
    name,
    sql: readFileSync(path.join(dir, name), 'utf8'),
  }));
}

function unitFiles(): UnitFile[] {
  const dir = path.join(ROOT, 'deploy', 'systemd');
  return readdirSync(dir)
    .filter((n) => /\.(service|timer)$/.test(n))
    .sort()
    .map((name) => ({ name, text: readFileSync(path.join(dir, name), 'utf8') }));
}

async function migrate(dry: boolean) {
  const run = sql();
  const files = migrationFiles();
  const plan = await planMigrations(run, files);
  log(`migrations: ${files.length} files in scripts/db`);
  describePlan(plan).forEach(log);
  if (dry) return log('dry run: nothing created, nothing applied');
  await applyMigrations(run, plan, files, ROLE, log);
  const pending = plan.steps.filter((s) => s.action !== 'skip').length;
  log(`migrations done: ${pending} recorded now, ${plan.steps.length - pending} already recorded`);
}

async function timers(dry: boolean) {
  const units = unitFiles();
  const problems = validateSet(units);
  if (problems.length) throw new Error(`unit files rejected:\n  ${problems.join('\n  ')}`);
  const remote = sshRemote(process.env.BOX ?? '');
  const changes = await planUnits(remote, units);
  changes.forEach((c) => log(`  ${c.state.padEnd(7)} ${c.name}`));
  if (dry) return log('dry run: nothing written, nothing enabled');
  await installUnits(remote, units, changes, log);
}

function runBackfill(url: string): Promise<number> {
  return new Promise((resolve) => {
    // Output goes straight to the job log; the URL is in the child's env only.
    const child = spawn('pnpm', ['exec', 'tsx', 'scripts/research/market-data.ts', '--backfill'], {
      cwd: ROOT,
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'inherit',
      signal: AbortSignal.timeout(BACKFILL_TIMEOUT_MS),
    });
    child.on('error', () => resolve(1));
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function backfill(dry: boolean) {
  const run = sql();
  const state = await run(
    `SELECT to_regclass('public.research_price_points') IS NOT NULL, to_regclass('public.schema_oneshots') IS NOT NULL;`,
  );
  const [hasTable, hasLedger] = state.split('|').map((v) => v === 't');
  if (!hasTable)
    throw new Error('research_price_points does not exist; migration 016 has not been applied');
  const done = hasLedger
    ? await run(`SELECT finished_at FROM public.schema_oneshots WHERE name = '${BACKFILL}';`)
    : '';
  if (done) return log(`backfill: already done at ${done}; nothing to do`);
  if (dry) return log('dry run: the backfill would run now (not yet recorded as done)');
  const url = process.env.SUBSTRATA_BACKFILL_DATABASE_URL;
  if (!url) throw new Error('SUBSTRATA_BACKFILL_DATABASE_URL is not set');
  log(`backfill: running (limit ${BACKFILL_TIMEOUT_MS / 60000} minutes)`);
  const code = await runBackfill(url);
  const rows = Number(await run('SELECT count(*) FROM public.research_price_points;'));
  if (code !== 0 || rows === 0) {
    throw new Error(
      `backfill not recorded: exit ${code}, ${rows} price rows; it will try again on the next deploy`,
    );
  }
  await run(
    `SET ROLE ${ROLE};\nINSERT INTO public.schema_oneshots(name, note) VALUES ('${BACKFILL}', '${rows} price rows after the run') ON CONFLICT DO NOTHING;`,
  );
  log(`backfill done and recorded: ${rows} rows in research_price_points`);
}

async function main() {
  const [command, flag] = process.argv.slice(2);
  const dry = flag === '--dry-run';
  if (command === 'migrate') await migrate(dry);
  else if (command === 'timers') await timers(dry);
  else if (command === 'backfill') await backfill(dry);
  else throw new Error('usage: data-layer.ts migrate|timers|backfill [--dry-run]');
}

main().catch((error) => {
  console.error(`data layer: ${error instanceof Error ? error.message : 'failed'}`);
  process.exit(1);
});
