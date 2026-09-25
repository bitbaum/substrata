/**
 * Nothing stale ships.
 *
 * A committed dataset states when it was last checked. Past the maximum age
 * declared for it in config/substrata-freshness.ts, this test fails — so a
 * file nobody has re-checked cannot keep being deployed as current. The fix
 * is to re-check it (each row names how) and move its date, or, if the
 * declared age was wrong, to change that in the same PR where a person sees it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DATASETS, FEEDS } from '../config/substrata-freshness';
import { ageDays, datasetState, feedState, queueState, worstOf } from '../lib/freshness/status';

test('no committed dataset is older than its declared maximum age', () => {
  const now = new Date();
  const stale = DATASETS.filter((d) => datasetState(d, now) === 'stale').map(
    (d) =>
      `${d.file} (${d.label}): checked ${d.checkedOn}, ${ageDays(d.checkedOn, now)} days ago, allowed ${d.maxAgeDays}. Refresh: ${d.refresh}`,
  );
  assert.deepEqual(stale, [], `Stale data would ship:\n  ${stale.join('\n  ')}`);
});

test('every dataset states a real date and a positive age limit', () => {
  for (const d of DATASETS) {
    assert.match(d.checkedOn, /^\d{4}-\d{2}-\d{2}$/, `${d.id} has no checked date`);
    assert.ok(d.maxAgeDays > 0, `${d.id} allows no age`);
    assert.ok(Date.parse(d.checkedOn) <= Date.now() + 86_400_000, `${d.id} is dated in the future`);
  }
});

test('the stale guard fires on an old file (the gate can fail)', () => {
  const now = new Date('2026-09-25T12:00:00Z');
  assert.equal(datasetState({ checkedOn: '2026-08-01', maxAgeDays: 30 }, now), 'stale');
  assert.equal(datasetState({ checkedOn: '2026-09-01', maxAgeDays: 30 }, now), 'late');
  assert.equal(datasetState({ checkedOn: '2026-09-24', maxAgeDays: 30 }, now), 'fresh');
  assert.equal(datasetState({ checkedOn: '', maxAgeDays: 30 }, now), 'unknown');
});

test('every feed reads a run table that a migration creates', () => {
  const sql = readdirSync(join(process.cwd(), 'scripts/db'))
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(process.cwd(), 'scripts/db', f), 'utf8'))
    .join('\n');
  for (const feed of FEEDS) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${feed.table} \\(`), feed.table);
    assert.doesNotMatch(feed.failedWhen, /;|--/, `${feed.id}: failedWhen is one condition`);
  }
});

test('a feed is fresh on time, late when a run is missed, stale when many are', () => {
  const now = new Date('2026-09-25T12:00:00Z');
  const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3_600_000).toISOString();
  assert.equal(feedState({ lastOk: at(1.2), lastFailure: null }, 1, now), 'fresh');
  assert.equal(feedState({ lastOk: at(2), lastFailure: null }, 1, now), 'late');
  assert.equal(feedState({ lastOk: at(4), lastFailure: null }, 1, now), 'stale');
  assert.equal(feedState({ lastOk: at(30), lastFailure: null }, 24, now), 'fresh');
  assert.equal(feedState({ lastOk: at(50), lastFailure: null }, 24, now), 'late');
  assert.equal(feedState({ lastOk: null, lastFailure: null }, 24, now), 'stale');
  assert.equal(feedState({ lastOk: null, lastFailure: null }, null, now), 'off');
});

test('a failure newer than the last good run is failing, an older one is history', () => {
  const now = new Date('2026-09-25T12:00:00Z');
  assert.equal(
    feedState({ lastOk: '2026-09-25T10:00:00Z', lastFailure: '2026-09-25T11:00:00Z' }, 1, now),
    'failing',
  );
  assert.equal(
    feedState({ lastOk: '2026-09-25T11:30:00Z', lastFailure: '2026-09-25T09:00:00Z' }, 1, now),
    'fresh',
  );
});

test('the review queue and the summary', () => {
  const now = new Date('2026-09-25T12:00:00Z');
  assert.equal(queueState(null, 7, now), 'fresh');
  assert.equal(queueState('2026-09-23T12:00:00Z', 7, now), 'fresh');
  assert.equal(queueState('2026-09-20T12:00:00Z', 7, now), 'late');
  assert.equal(queueState('2026-09-10T12:00:00Z', 7, now), 'stale');
  assert.equal(worstOf(['fresh', 'late', 'off']), 'late');
  assert.equal(worstOf(['fresh', 'failing', 'stale']), 'failing');
  assert.equal(worstOf(['off']), 'off');
});

test('drafting is reported on demand, never late: it runs only on readers’ own keys', () => {
  const drafts = FEEDS.find((f) => f.id === 'drafts');
  assert.ok(drafts?.onDemand, 'the drafts feed must say it runs on demand');
  assert.equal(drafts.everyHours, null, 'no clock runs drafting, so none may make it late');
  for (const f of FEEDS.filter((f) => f.onDemand)) assert.equal(f.everyHours, null, f.id);
});
