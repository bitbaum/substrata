/**
 * The migration runner against a real, scratch PostgreSQL. Skipped unless
 * SUBSTRATA_TEST_PG_URL points at a superuser connection (CI starts a service
 * container for it; locally: any throwaway cluster). Each test gets its own database.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { localPsql } from '../scripts/ops/box';
import {
  applyMigrations,
  migrationNames,
  planMigrations,
  type MigrationFile,
} from '../scripts/ops/migrations';

const ADMIN = process.env.SUBSTRATA_TEST_PG_URL;
const DB_DIR = path.join(import.meta.dirname, '..', 'scripts', 'db');
const files: MigrationFile[] = migrationNames(readdirSync(DB_DIR)).map((name) => ({
  name,
  sql: readFileSync(path.join(DB_DIR, name), 'utf8'),
}));

let counter = 0;
async function scratch() {
  const admin = localPsql(ADMIN!);
  const name = `substrata_t${process.pid}_${counter++}`;
  await admin(
    `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'substrata') THEN CREATE ROLE substrata; END IF; END $$;`,
  );
  await admin(`CREATE DATABASE ${name} OWNER substrata;`);
  const url = new URL(ADMIN!);
  url.pathname = `/${name}`;
  return {
    run: localPsql(url.toString()),
    url: url.toString(),
    drop: () => admin(`DROP DATABASE ${name};`),
  };
}
const quiet = () => undefined;
const opts = { skip: ADMIN ? false : 'SUBSTRATA_TEST_PG_URL is not set' };

test(
  'fresh database: every file applies, owned by the app role, and a second run does nothing',
  opts,
  async () => {
    const db = await scratch();
    try {
      const plan = await planMigrations(db.run, files);
      assert.ok(plan.steps.every((s) => s.action === 'apply'));
      await applyMigrations(db.run, plan, files, 'substrata', quiet);
      const again = await planMigrations(db.run, files);
      assert.ok(again.steps.every((s) => s.action === 'skip'));
      assert.equal(
        await db.run('SELECT count(*) FROM public.schema_migrations;'),
        String(files.length),
      );
      assert.equal(
        await db.run(`SELECT tableowner FROM pg_tables WHERE tablename = 'research_price_points';`),
        'substrata',
      );
      // Running the whole set again by hand must change nothing (the idempotence the baseline relies on).
      for (const f of files) await db.run(f.sql);
    } finally {
      await db.drop();
    }
  },
);

test('database that predates the ledger: complete files are recorded, incomplete and new ones run', async (t) => {
  if (!ADMIN) return t.skip('SUBSTRATA_TEST_PG_URL is not set');
  const db = await scratch();
  try {
    for (const f of files.slice(0, -1)) await db.run(f.sql); // how 001..015 got there
    await db.run('DROP TABLE research_source_runs;'); // one file left incomplete on purpose
    const plan = await planMigrations(db.run, files);
    const by = Object.fromEntries(plan.steps.map((s) => [s.name, s]));
    assert.ok(plan.misowned.includes('research_source_candidates')); // created above as the superuser
    assert.equal(by['001-research-service.sql'].action, 'baseline');
    assert.equal(by['004-source-sweep.sql'].action, 'apply');
    assert.deepEqual(by['004-source-sweep.sql'].missing, ['table research_source_runs']);
    assert.equal(by['016-market-data.sql'].action, 'apply');
    await applyMigrations(db.run, plan, files, 'substrata', quiet);
    assert.equal(
      await db.run(
        `SELECT how FROM public.schema_migrations WHERE filename = '001-research-service.sql';`,
      ),
      'baseline',
    );
    assert.equal(
      await db.run(`SELECT to_regclass('public.research_source_runs') IS NOT NULL;`),
      't',
    );
    assert.ok((await planMigrations(db.run, files)).steps.every((s) => s.action === 'skip'));
  } finally {
    await db.drop();
  }
});

test('a failing migration rolls back whole, is not recorded, and stops the files after it', async (t) => {
  if (!ADMIN) return t.skip('SUBSTRATA_TEST_PG_URL is not set');
  const db = await scratch();
  try {
    const set: MigrationFile[] = [
      ...files,
      {
        name: '900-bad.sql',
        sql: 'CREATE TABLE IF NOT EXISTS half_done (a int);\nSELECT 1/0;\n',
      },
      { name: '901-after.sql', sql: 'CREATE TABLE IF NOT EXISTS after_bad (a int);\n' },
    ];
    const plan = await planMigrations(db.run, set);
    await assert.rejects(
      applyMigrations(db.run, plan, set, 'substrata', quiet),
      /900-bad\.sql failed and was rolled back/,
    );
    assert.equal(await db.run(`SELECT to_regclass('public.half_done') IS NULL;`), 't');
    assert.equal(await db.run(`SELECT to_regclass('public.after_bad') IS NULL;`), 't');
    assert.equal(
      await db.run(`SELECT count(*) FROM public.schema_migrations WHERE filename LIKE '90%';`),
      '0',
    );
    assert.equal(
      await db.run('SELECT count(*) FROM public.schema_migrations;'),
      String(files.length),
    );
  } finally {
    await db.drop();
  }
});

test('dry run reads and plans but creates nothing', async (t) => {
  if (!ADMIN) return t.skip('SUBSTRATA_TEST_PG_URL is not set');
  const db = await scratch();
  try {
    const out = execFileSync(
      'pnpm',
      ['exec', 'tsx', 'scripts/ops/data-layer.ts', 'migrate', '--dry-run'],
      {
        cwd: path.join(import.meta.dirname, '..'),
        env: { ...process.env, SUBSTRATA_PSQL_URL: db.url },
        encoding: 'utf8',
      },
    );
    assert.match(out, /apply\s+016-market-data\.sql/);
    assert.match(out, /dry run: nothing created/);
    assert.equal(await db.run(`SELECT to_regclass('public.schema_migrations') IS NULL;`), 't');
    assert.equal(await db.run(`SELECT count(*) FROM pg_tables WHERE schemaname = 'public';`), '0');
  } finally {
    await db.drop();
  }
});
