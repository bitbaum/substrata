/**
 * The task runner: a dossier task in, the adapters that serve its box run
 * offline on recorded responses, each row marked whether it fills the box.
 * And the queue no longer parks a task for a facet add.ts lacks.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { boxDefinition } from '../lib/dossier/definitions';
import { emitTasks } from '../lib/dossier/tasks';
import { countsFor, plansFor, runPlans } from '../lib/sources/registry';
import { findTask, parseRunTaskArgs } from '../scripts/research/run-task';
import { offline } from './sources-fixtures';

test('run-task reads a task id or --entity/--box, and the adapter flags', () => {
  const a = parseRunTaskArgs(['country:kz#trade', '--cik', '1801368', '--write']);
  assert.deepEqual([a.entity, a.box, a.cik, a.write], ['country:kz', 'trade', 1801368, true]);
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
