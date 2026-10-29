import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import type { Remote, SqlRunner } from '../scripts/ops/box';
import {
  declaredObjects,
  describePlan,
  migrationNames,
  planMigrations,
  wrapMigration,
} from '../scripts/ops/migrations';
import {
  installUnits,
  planUnits,
  validateSet,
  validateUnit,
  type UnitFile,
} from '../scripts/ops/timers';

const DB_DIR = path.join(import.meta.dirname, '..', 'scripts', 'db');
const UNIT_DIR = path.join(import.meta.dirname, '..', 'deploy', 'systemd');
const files = migrationNames(readdirSync(DB_DIR)).map((name) => ({
  name,
  sql: readFileSync(path.join(DB_DIR, name), 'utf8'),
}));
const units: UnitFile[] = readdirSync(UNIT_DIR).map((name) => ({
  name,
  text: readFileSync(path.join(UNIT_DIR, name), 'utf8'),
}));

test('migration files: only NNN-name.sql, in filename order, seed file excluded', () => {
  const names = migrationNames(['016-b.sql', 'seed-development-profile.sql', '002-a.sql', 'x.txt']);
  assert.deepEqual(names, ['002-a.sql', '016-b.sql']);
  assert.ok(files.length >= 16 && files.some((f) => f.name === '016-market-data.sql'));
});

// The first-run baseline step re-runs any file it cannot prove is applied, which is
// only safe if a second run changes nothing. This is the rule every file must keep.
test('every migration is idempotent and leaves transaction control to the runner', () => {
  const bad: string[] = [];
  for (const { name, sql } of files) {
    const text = sql.replace(/--[^\n]*/g, '').replace(/'(?:[^']|'')*'/g, "''");
    const statements = text
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const s of statements) {
      const head = s.replace(/\s+/g, ' ');
      if (/^(begin|commit)$/i.test(head)) continue;
      const ok =
        /^create table if not exists /i.test(head) ||
        /^create (unique )?index if not exists /i.test(head) ||
        /^alter table .* add column if not exists /i.test(head) ||
        /^comment on /i.test(head) ||
        /^insert into .* on conflict /i.test(head);
      if (!ok) bad.push(`${name}: ${head.slice(0, 70)}`);
      if (/\b(drop|truncate|delete\s+from)\b/i.test(head))
        bad.push(`${name}: destructive ${head.slice(0, 40)}`);
    }
    if (/\$\$|\b(set|reset)\s+(local\s+)?role\b/i.test(text))
      bad.push(`${name}: $$ body or role change`);
    if (
      /\b(begin|commit)\b(?!\s*;\s*$)/im.test(text.replace(/^\s*(begin|commit)\s*;\s*$/gim, ''))
    ) {
      bad.push(`${name}: transaction control that is not a standalone BEGIN; or COMMIT; line`);
    }
  }
  assert.deepEqual(bad, []);
});

test('declaredObjects reads tables, indexes and added columns, ignoring comments and strings', () => {
  const d = declaredObjects(`
    -- CREATE TABLE ghost (x int);
    CREATE TABLE IF NOT EXISTS public.Alpha (id int);
    CREATE UNIQUE INDEX IF NOT EXISTS alpha_idx ON alpha(id);
    ALTER TABLE alpha ADD COLUMN IF NOT EXISTS a int, ADD COLUMN IF NOT EXISTS b int;
    COMMENT ON TABLE alpha IS 'create table in a string';
  `);
  assert.deepEqual(d.tables, ['alpha']);
  assert.deepEqual(d.indexes, ['alpha_idx']);
  assert.deepEqual(d.columns, [
    ['alpha', 'a'],
    ['alpha', 'b'],
  ]);
  assert.ok(
    declaredObjects(files.find((f) => f.name === '016-market-data.sql')!.sql).tables.includes(
      'research_price_points',
    ),
  );
});

test('wrapMigration: own transaction, role, lock timeout, ledger row last', () => {
  const out = wrapMigration(
    '016-x.sql',
    'BEGIN;\nCREATE TABLE IF NOT EXISTS t (a int);\nCOMMIT;\n',
    'substrata',
  );
  const lines = out.split('\n').filter(Boolean);
  assert.equal(lines[0], 'BEGIN;');
  assert.equal(lines.filter((l) => /^(BEGIN|COMMIT);$/.test(l)).length, 2);
  assert.equal(lines.at(-1), 'COMMIT;');
  assert.match(lines.at(-2)!, /INSERT INTO public\.schema_migrations.*'016-x\.sql'/);
  assert.match(out, /SET LOCAL ROLE substrata/);
  assert.match(out, /lock_timeout/);
  assert.throws(() => wrapMigration('a.sql', '', 'x; DROP'), /plain identifier/);
});

/** A fake database: a ledger, and a set of existing tables. */
function fake(opts: { ledger?: string[]; tables?: string[] }): { run: SqlRunner; calls: string[] } {
  const calls: string[] = [];
  const run: SqlRunner = async (sql) => {
    calls.push(sql);
    if (/to_regclass\('public\.schema_migrations'\)/.test(sql)) return opts.ledger ? 't' : 'f';
    if (/FROM public\.schema_migrations/.test(sql))
      return [String(opts.ledger!.length), ...opts.ledger!].join('\n');
    if (/unnest/.test(sql)) {
      const missing: string[] = [];
      for (const m of sql.matchAll(/'(table|index) ' \|\| n FROM unnest\(ARRAY\[([^\]]*)\]/g)) {
        for (const n of m[2].matchAll(/'([a-z0-9_]+)'/g)) {
          if (!(opts.tables ?? []).includes(n[1])) missing.push(`${m[1]} ${n[1]}`);
        }
      }
      return missing.join('\n');
    }
    if (/FROM pg_tables/.test(sql)) return '';
    throw new Error(`unexpected sql: ${sql.slice(0, 40)}`);
  };
  return { run, calls };
}

test('plan, ledger present: recorded files skip, new ones apply, nothing is probed', async () => {
  const db = fake({ ledger: files.slice(0, -1).map((f) => f.name) });
  const plan = await planMigrations(db.run, files);
  assert.deepEqual(
    plan.steps.filter((s) => s.action === 'apply').map((s) => s.name),
    [files.at(-1)!.name],
  );
  assert.equal(plan.steps.filter((s) => s.action === 'skip').length, files.length - 1);
  assert.ok(!db.calls.some((c) => /unnest/.test(c)));
});

test('plan, first run: baseline only what exists; say what is missing for the rest', async () => {
  const have = files.slice(0, -1).flatMap((f) => {
    const d = declaredObjects(f.sql);
    return [...d.tables, ...d.indexes];
  });
  const plan = await planMigrations(fake({ tables: have }).run, files);
  const last = plan.steps.at(-1)!;
  // The newest file, whichever it is; it creates at least one table.
  const newest = files.at(-1)!;
  const table = declaredObjects(newest.sql).tables[0];
  assert.equal(last.name, newest.name);
  assert.equal(last.action, 'apply');
  assert.ok(last.missing.some((m) => m.includes(table)));
  assert.ok(plan.steps.slice(0, -1).every((s) => s.action === 'baseline'));
  assert.match(describePlan(plan).join('\n'), new RegExp(`missing: .*${table}`));
});

test('plan refuses a ledger read that came back short', async () => {
  const run: SqlRunner = async (sql) =>
    /to_regclass/.test(sql) ? 't' : '3\n001-research-service.sql\n002-page-threads.sql';
  await assert.rejects(planMigrations(run, files), /incomplete/);
});

test('unit files in the repo are valid, paired, and run the prices route daily at 22:07 UTC', () => {
  assert.deepEqual(validateSet(units), []);
  const timer = units.find((u) => u.name === 'appcron-substrata-prices.timer')!;
  assert.match(timer.text, /OnCalendar=\*-\*-\* 22:07:00 UTC/);
  assert.match(
    units.find((u) => u.name.endsWith('prices.service'))!.text,
    /ExecStart=\/opt\/_appcron\/run\.sh substrata 4022 \/api\/cron\/prices POST/,
  );
});

test('unit validation refuses anything but an appcron call of this app', () => {
  const svc = (exec: string, extra = '') =>
    `[Unit]\nDescription=x\n[Service]\nType=oneshot\nExecStart=${exec}\n${extra}`;
  const ok = '/opt/_appcron/run.sh substrata 4022 /api/cron/prices POST';
  assert.deepEqual(validateUnit({ name: 'appcron-substrata-a.service', text: svc(ok) }), []);
  for (const bad of [
    '/bin/sh -c id',
    '/opt/_appcron/run.sh solon 4018 /api/cron/places POST',
    '/opt/_appcron/run.sh substrata 4022 /api/other POST',
    '/opt/_appcron/run.sh substrata 4022 /api/cron/a PUT',
  ])
    assert.notDeepEqual(
      validateUnit({ name: 'appcron-substrata-a.service', text: svc(bad) }),
      [],
      bad,
    );
  assert.notDeepEqual(
    validateUnit({ name: 'appcron-substrata-a.service', text: svc(ok, 'User=root\n') }),
    [],
  );
  assert.notDeepEqual(validateUnit({ name: 'ssh.service', text: svc(ok) }), []);
  assert.notDeepEqual(validateSet([{ name: 'appcron-substrata-a.service', text: svc(ok) }]), []); // no timer beside it
});

test('install: writes only what differs, reloads once, enables every timer, nothing else', async () => {
  const onBox = new Map<string, string>([
    ['appcron-substrata-prices.service', units.find((u) => u.name.endsWith('.service'))!.text],
  ]);
  const sent: string[] = [];
  const remote: Remote = async (cmd, stdin) => {
    sent.push(cmd);
    const read = cmd.match(/^if \[ -f '\/etc\/systemd\/system\/([^']+)' \]/);
    if (read) return onBox.has(read[1]) ? `present\n${onBox.get(read[1])}` : '';
    const write = cmd.match(/^sudo tee '\/etc\/systemd\/system\/([^']+)'/);
    if (write) onBox.set(write[1], stdin ?? '');
    return cmd.startsWith('systemctl list-timers') ? 'NEXT ...\nTue 22:07' : '';
  };
  const changes = await planUnits(remote, units);
  assert.deepEqual(
    changes.map((c) => c.state),
    ['same', 'new'],
  );
  const lines: string[] = [];
  await installUnits(remote, units, changes, (l) => lines.push(l));
  const writes = sent.filter((c) => c.startsWith('sudo tee'));
  assert.equal(writes.length, 1);
  assert.equal(sent.filter((c) => c === 'sudo systemctl daemon-reload').length, 1);
  assert.ok(sent.includes("sudo systemctl enable --now 'appcron-substrata-prices.timer'"));
  assert.ok(sent.every((c) => !/rm |curl|bash -c/.test(c)));
  // A second run is a no-op apart from re-enabling.
  sent.length = 0;
  const again = await planUnits(remote, units);
  assert.deepEqual(
    again.map((c) => c.state),
    ['same', 'same'],
  );
  await installUnits(remote, units, again, () => undefined);
  assert.ok(!sent.some((c) => c.startsWith('sudo tee') || c.includes('daemon-reload')));
});
