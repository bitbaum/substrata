/**
 * Accepting at /review publishes at once: rows accepted in the database join
 * EVENTS and every table derived from it, never twice, never past the rules,
 * and a database that cannot be read leaves the site exactly as the file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { EVENTS, IN_CORPUS_FILE, eventsFor, type CoverageEvent } from '../config/substrata-events';
import { BOTTLENECKS } from '../lib/bottlenecks';
import { mergeAccepted, syncAcceptedEvents } from '../lib/events-live';

const rail = BOTTLENECKS[0].name;

const row = (over: Partial<CoverageEvent> = {}): CoverageEvent => ({
  id: '2026-09-29-test-accepted-live',
  date: '2026-09-29',
  headline: 'A test event accepted at review.',
  kind: EVENTS[0].kind,
  effect: 'tightens',
  bottlenecks: [rail],
  participants: [],
  jurisdictions: ['US'],
  source: 'https://example.com/accepted-live',
  primary: true,
  quote: 'A sentence long enough to carry the claim.',
  acceptedOn: '2026-10-01',
  ...over,
});

test('merges a new accepted row once, by id and by source', () => {
  const list = [...EVENTS];
  assert.equal(mergeAccepted(list, [row()]), 1);
  assert.equal(mergeAccepted(list, [row()]), 0, 'same id');
  assert.equal(mergeAccepted(list, [row({ id: 'other-id' })]), 0, 'same source');
  assert.equal(mergeAccepted(list, [{ ...EVENTS[0] }]), 0, 'already in the file');
});

test('refuses a row the review rules would refuse', () => {
  const list = [...EVENTS];
  assert.equal(mergeAccepted(list, [row({ bottlenecks: ['Not a bottleneck'] })]), 0);
  assert.equal(mergeAccepted(list, [row({ date: '2999-01-01' })]), 0);
});

test('a sync publishes to EVENTS and to the bottleneck table; the file snapshot is untouched', async () => {
  const before = EVENTS.length;
  const added = await syncAcceptedEvents({ force: true, load: async () => [row()] });
  assert.equal(added, 1);
  assert.equal(EVENTS.length, before + 1);
  assert.ok(eventsFor(rail).some((e) => e.id === row().id));
  assert.ok(
    BOTTLENECKS[0].events.some((e) => e.id === row().id),
    'derived table refreshed',
  );
  assert.equal(IN_CORPUS_FILE.ids.has(row().id), false, 'still awaiting the git file');
});

test('an unreadable database leaves the site as it was', async () => {
  const before = EVENTS.length;
  const added = await syncAcceptedEvents({
    force: true,
    load: async () => {
      throw new Error('no database');
    },
  });
  assert.equal(added, 0);
  assert.equal(EVENTS.length, before);
});
