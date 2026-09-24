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
import { readFileSync, readdirSync } from 'node:fs';

import { isNeverAnEvent, looksLikeAReference, nodes } from '../lib/sweep';
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

test('a reference page is rejected by its title, and a real event is not', () => {
  // Every title here is real: these are what the FIRST scheduled run on the box
  // actually filed, so the filter is measured against observed noise rather
  // than an imagined shape. Four of eleven candidates were reference pages.
  const references = [
    'Tin Price Trend 2026 | Forecast, History, Chart & Index',
    'Tin - Price - Chart - Historical Data - News',
    'Neon Gas in Semiconductors: Complete Guide & Applications',
    'What is Ruthenium? Properties and Uses',
    'Gallium Market Size, Share & Industry Analysis 2026',
  ];
  for (const title of references) {
    assert.equal(looksLikeAReference(title), true, `should be rejected: ${title}`);
  }

  // And the ones that must survive. A shortage analysis names a price and a
  // market too, so a filter keyed on those words alone would delete the very
  // rows the sweep exists to find.
  const events = [
    'Polysilicon Industry Is Risking New Shortage | Bernreuter',
    'Cell prices soften, while module prices rise in non-China markets',
    'Trump Administration Imposes Section 232 Tariffs and Minimum Import Prices',
    'TSMC to Build Neon Supply Chain After Russia Decimated Global Supply',
    '2026 Update of the EU Control List of Dual-Use Items',
  ];
  for (const title of events) {
    assert.equal(looksLikeAReference(title), false, `should survive: ${title}`);
  }

  // A page the reader could not title is not evidence of an SEO page; throwing
  // it away would hide a real event behind a parsing failure.
  assert.equal(looksLikeAReference(''), false, 'an empty title is not a reference page');
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

test('freshness is reported in three states, never collapsed into two', () => {
  // "We did not look" and "we looked and found nothing" are different answers.
  // A site that cannot tell them apart reports a quiet week while its search
  // backend has been down — the single worst failure available to a service
  // whose product is knowing what changed.
  const page = readFileSync(new URL('../app/data/page.tsx', import.meta.url), 'utf8');
  assert.ok(
    page.includes('sweep === null'),
    'a failure to READ the run record must be its own state, not zero',
  );
  assert.ok(
    page.includes('sweep.lastRunAt === null'),
    'a sweep that has never completed must be its own state, not a stale date',
  );
  assert.ok(page.includes('sweep.blind'), 'nodes the sweep could not look at must be reported');
});

test('the homepage does not present a corpus date as a freshness signal', () => {
  // It read "Updated <date>", where the date was the newest RECORD in the
  // corpus. Both halves were true and the sentence was not: nothing had been
  // looked at on that date, and a dead sweep looked exactly like a quiet week.
  // The page and the sections it is composed of (app/_home/), read as one.
  const sections = new URL('../app/_home/', import.meta.url);
  const home = [
    readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8'),
    ...readdirSync(sections)
      .filter((f) => f.endsWith('.tsx'))
      .map((f) => readFileSync(new URL(f, sections), 'utf8')),
  ].join('\n');
  assert.ok(
    !/\bUpdated \{/.test(home),
    'a record date must not be labelled "Updated" — say which date it is',
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

test('the producer-sourcing cron route is guarded the same way', () => {
  // Same engine class, same box mechanism, same gate — see lib/source-store.ts.
  const route = readFileSync(new URL('../app/api/cron/source/route.ts', import.meta.url), 'utf8');
  assert.ok(route.includes('CRON_SECRET'), 'the route must require the shared secret');
  assert.ok(route.includes('401'), 'a wrong secret must be refused');
  assert.ok(route.includes('503'), 'an unconfigured secret must refuse, not allow');
  assert.ok(!/export async function GET/.test(route), 'a sourcing run is not a GET');
});
