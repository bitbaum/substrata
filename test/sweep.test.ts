/**
 * The sweep decides what counts as an event, and now runs unattended.
 *
 * Two things matter once a timer is driving it: the scheduled run and the
 * hand-run one must agree about what a candidate is, and nothing it finds may
 * reach a page without a person. The first is structural — one module — and
 * these tests hold the second.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { isNeverAnEvent, nodes } from '../lib/sweep';
import { BOTTLENECKS } from '../lib/bottlenecks';

test('the sweep covers every bottleneck in the corpus', () => {
  // A node missing here is a row that never gets looked at again, silently.
  const swept = new Set(nodes().map((n) => n.name));
  const missing = BOTTLENECKS.filter((b) => !swept.has(b.name)).map((b) => b.name);
  assert.deepEqual(missing, [], `Bottlenecks the sweep never visits:\n  ${missing.join('\n  ')}`);
  assert.ok(
    nodes().every((n) => n.term.trim().length > 2),
    'a node with no search term is blind',
  );
});

test('junk domains are filtered on a host boundary, not a substring', () => {
  // `host.includes('x.com')` matched `semiconductorx.com`, so the sweep was
  // discarding trade press invisibly — a filtered result leaves no trace.
  assert.equal(isNeverAnEvent('https://www.linkedin.com/posts/x'), true);
  assert.equal(isNeverAnEvent('https://www.researchandmarkets.com/report'), true);
  assert.equal(isNeverAnEvent('https://semiconductorx.com/news'), false);
  assert.equal(isNeverAnEvent('https://simplytronix.com/news'), false);
  assert.equal(isNeverAnEvent('not a url'), true, 'an unparseable URL is not an event');
});

test('the scheduled sweep writes to a queue, never to the corpus', () => {
  // The corpus is files in git, accepted by a person in a commit. A timer that
  // could publish would make every row on the site unverifiable in principle.
  const store = readFileSync(new URL('../lib/sweep-store.ts', import.meta.url), 'utf8');
  for (const forbidden of ['writeFile', 'research/events.json', 'config/substrata']) {
    assert.ok(!store.includes(forbidden), `the scheduled sweep must not touch ${forbidden}`);
  }
  assert.ok(
    store.includes('research_sweep_candidates'),
    'findings should land in the review queue',
  );
});

test('the cron route refuses to run unconfigured or unauthenticated', () => {
  // An open sweep endpoint spends web and model budget for whoever finds it,
  // so a missing secret must close the door rather than open it.
  const route = readFileSync(new URL('../app/api/cron/sweep/route.ts', import.meta.url), 'utf8');
  assert.ok(route.includes('CRON_SECRET'), 'the route must require the shared secret');
  assert.ok(route.includes('401'), 'a wrong secret must be refused');
  assert.ok(route.includes('503'), 'an unconfigured secret must refuse, not allow');
  assert.ok(!/export async function GET/.test(route), 'a sweep is not a GET');
});
