/**
 * The task runner: a dossier task in, the adapters that serve its box run
 * offline on recorded responses, each row marked whether it fills the box.
 * And the queue no longer parks a task for a facet add.ts lacks.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { boxDefinition } from '../lib/dossier/definitions';
import { emitTasks } from '../lib/dossier/tasks';
import { countsFor, plansFor, runPlans } from '../lib/sources/registry';
import { relationCandidateId, type RelationCandidate } from '../lib/entry/candidate';
import { readDocument } from '../lib/sources/document';
import type { PageRead } from '../scripts/research/add';
import { findTask, main, parseRunTaskArgs } from '../scripts/research/run-task';
import { prReport, selectRows } from '../scripts/research/run-task-report';
import type { DocumentDeps } from '../lib/sources/document';
import { fixtureFetch, offline } from './sources-fixtures';

test('run-task reads a task id or --entity/--box, and the adapter flags', () => {
  const a = parseRunTaskArgs(['country:kz#trade', '--cik', '1801368', '--write']);
  assert.deepEqual([a.entity, a.box, a.cik, a.write], ['country:kz', 'trade', 1801368, true]);
  assert.equal(a.includeLeads, undefined, 'leads are off unless asked for');
  assert.equal(parseRunTaskArgs(['country:kz#trade', '--include-leads']).includeLeads, true);
  assert.throws(() => parseRunTaskArgs(['--lei']), /needs a value/);
});

test('country:kz#trade runs Comtrade and Kazatomprom; Comtrade rows fill the box', async () => {
  const task = findTask({ entity: 'country:kz', box: 'trade', write: false });
  assert.ok(task, 'the trade box is an open task');
  const plans = plansFor(task, { runId: 't', hs: '284410', period: '2024', top: 2, deps: offline });
  assert.deepEqual(
    plans.map((p) => p.adapter),
    ['comtrade', 'kazatomprom'],
  );
  const results = await runPlans(plans);
  const queries = boxDefinition('country', 'trade')!.relations!;
  const comtrade = results.find((r) => r.adapter === 'comtrade')!;
  assert.equal(comtrade.rows.length, 2);
  assert.ok(comtrade.rows.every((r) => countsFor(task, r, queries)));
});

test('a company owners task asks for the LEI and QID instead of guessing them', () => {
  const task = emitTasks({ entity: 'company:carl-zeiss-smt', box: 'owners' })[0];
  if (!task) return; // the box is full: nothing to ask
  const plans = plansFor(task, { runId: 't' });
  assert.match(plans.find((p) => p.adapter === 'gleif')!.needs!, /--lei/);
  assert.match(plans.find((p) => p.adapter === 'wikidata')!.needs!, /--qid/);
});

test('no task is parked for a facet add.ts lacks: relations is one', () => {
  const parked = emitTasks().filter((t) =>
    /facet is not in scripts\/research\/add\.ts/.test(t.blockedBy ?? ''),
  );
  assert.deepEqual(
    parked.map((t) => t.id),
    [],
  );
});

/**
 * The recorded responses, but with Comtrade's Russia record marked estimated:
 * that weight makes a `lead`, which is what the lead rules are about.
 */
const estimated: DocumentDeps = {
  ...offline,
  fetch: async (input, init) => {
    const res = await fixtureFetch(input, init);
    if (!String(input).endsWith('partnerCode=643')) return res;
    const body = (await res.text()).replace(
      '"isNetWgtEstimated":false',
      '"isNetWgtEstimated":true',
    );
    return new Response(body, { status: 200, headers: res.headers });
  },
};

/** run-task end to end, offline: adapters on recorded responses, add.ts on a temp sidecar. */
async function runOffline(argv: string[]) {
  const dir = await mkdtemp(path.join(tmpdir(), 'run-task-test-'));
  await writeFile(path.join(dir, 'relations.json'), '[]\n');
  const lines: string[] = [];
  const read = async (url: string): Promise<PageRead> => {
    const doc = await readDocument(url, estimated);
    return doc.ok
      ? { ok: true, text: doc.text, ...(doc.pages ? { pages: doc.pages } : {}) }
      : { ok: false, reason: doc.reason };
  };
  const code = await main(
    [
      'country:kz#trade',
      '--hs',
      '284410',
      '--period',
      '2024',
      '--top',
      '2',
      '--run-id',
      't',
      ...argv,
    ],
    (l) => lines.push(l),
    { plan: { deps: estimated }, add: { read, candidatesDir: dir } },
  );
  const written = JSON.parse(await readFile(path.join(dir, 'relations.json'), 'utf8'));
  return { code, out: lines.join('\n'), written: written as RelationCandidate[] };
}

test('run-task --write leaves leads out unless --include-leads, and says why each is a lead', async () => {
  const plain = await runOffline(['--write']);
  assert.equal(plain.code, 0, plain.out);
  assert.ok(plain.written.length > 0);
  assert.ok(
    plain.written.every((r) => r.grade === 'stated'),
    'no lead written by default',
  );
  assert.match(plain.out, /lead because: .*Comtrade marks this weight as estimated/);
  assert.match(plain.out, /a lead, not written without --include-leads/);

  const all = await runOffline(['--write', '--include-leads']);
  assert.equal(all.code, 0, all.out);
  assert.ok(
    all.written.some((r) => r.grade === 'lead'),
    'leads written on opt-in',
  );
  assert.equal(
    all.written.length,
    plain.written.length + all.written.filter((r) => r.grade === 'lead').length,
  );
});

test('run-task ends with a plain list for the PR: rows written, rows skipped with reasons', async () => {
  const { out, written } = await runOffline(['--write']);
  const report = out.split('--- paste into the PR description ---\n')[1];
  assert.ok(report, out);
  assert.match(
    report,
    new RegExp(`Rows written to config/candidates/relations.json \\(${written.length}\\):`),
  );
  assert.match(
    report,
    /- country:kz\|ships_to\|country:cn\|2024\|hs-284410-natural-uranium-and-compounds \(stated\)/,
  );
  assert.match(
    report,
    /Rows skipped \(\d+\):\n- \[comtrade\]|Rows skipped \(\d+\):\n- \[kazatomprom\]/,
  );
  assert.match(report, /regions are not entities/);
  assert.doesNotMatch(report, /\*\*|`|^#/m, 'plain text, no markdown');
});

test('selectRows: a row the corpus already has is skipped, so a re-run proposes only what is new', () => {
  const row = {
    evidence: 'candidate',
    asOf: '2024',
    from: 'country:kz',
    to: 'country:cn',
    type: 'ships_to',
    grade: 'stated',
    source: {
      url: 'https://example.org/x',
      quote: 'a quote long enough to count',
      readOn: '2026-10-24',
    },
    submittedBy: { agent: 't', model: 'unrecorded', runId: 't' },
  } as RelationCandidate;
  const known = new Set([relationCandidateId(row)]);
  const { write, skipped } = selectRows([row], { known, includeLeads: false });
  assert.deepEqual(write, []);
  assert.match(skipped[0].reason, /already in the corpus/);
  const text = prReport({
    task: 'country:kz#trade',
    runId: 't',
    outcome: 'dry-run',
    rows: write,
    skipped,
  });
  assert.match(text, /Rows proposed, not written \(dry run\) \(0\):\n- none/);
});
