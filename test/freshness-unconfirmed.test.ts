/**
 * Rows a re-check tried and could not confirm (lib/freshness/unconfirmed.ts):
 * the gate may carry them only as a visible, expiring exception.
 *
 * - a row neither re-dated nor listed makes its dataset stale;
 * - a listed row counts as tried on `triedOn`, and that entry expires like
 *   any date — next month's run must try again;
 * - a dataset with listed rows is never "fresh", and the page names each row
 *   with its reason.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import series from '../research/series.json';
import jobBoards from '../research/job-boards.json';
import { DATASETS, type Dataset } from '../config/substrata-freshness';
import { oldestLookedAt, updateUnconfirmed } from '../lib/freshness/unconfirmed';
import { datasetState } from '../lib/freshness/status';
import { DatasetTable } from '../components/freshness/DatasetTable';

const now = new Date('2026-10-25T12:00:00Z');
const rows = [
  { id: 'a', checkedOn: '2026-10-25' },
  { id: 'b', checkedOn: '2026-09-01' },
];
const judge = (unconfirmed: Dataset['unconfirmed']) =>
  datasetState(
    { checkedOn: oldestLookedAt(rows, unconfirmed ?? []), maxAgeDays: 30, unconfirmed },
    now,
  );

test('a row neither re-dated nor listed makes the dataset stale', () => {
  assert.equal(judge([]), 'stale');
});

test('a listed row counts as tried, and the dataset says so: late, never fresh', () => {
  assert.equal(judge([{ id: 'b', reason: 'HTTP 503', triedOn: '2026-10-25' }]), 'late');
  assert.equal(datasetState({ checkedOn: '2026-10-25', maxAgeDays: 30 }, now), 'fresh');
});

test('an unconfirmed entry expires like any date', () => {
  assert.equal(judge([{ id: 'b', reason: 'HTTP 503', triedOn: '2026-09-10' }]), 'stale');
});

test('a listing for another row covers nothing', () => {
  assert.equal(judge([{ id: 'c', reason: 'HTTP 503', triedOn: '2026-10-25' }]), 'stale');
});

test('a run records what failed today and drops what it now confirms', () => {
  const list = [
    { id: 'a', reason: 'old', triedOn: '2026-09-01' },
    { id: 'z', reason: 'untouched', triedOn: '2026-10-01' },
  ];
  assert.deepEqual(
    updateUnconfirmed(list, { confirmed: ['a'], failed: [{ id: 'b', reason: 'gone' }] }, 'D'),
    [
      { id: 'b', reason: 'gone', triedOn: 'D' },
      { id: 'z', reason: 'untouched', triedOn: '2026-10-01' },
    ],
  );
});

test('every listed row exists in its dataset and says why', () => {
  const ids = {
    'research/series.json': new Set(series.series.map((s) => s.id)),
    'research/job-boards.json': new Set(Object.keys(jobBoards.companies)),
  };
  for (const d of DATASETS) {
    for (const u of d.unconfirmed ?? []) {
      assert.ok(ids[d.file as keyof typeof ids]?.has(u.id), `${d.id}: ${u.id} is not a row`);
      assert.ok(u.reason.length > 5, `${d.id}: ${u.id} has no reason`);
      assert.match(u.triedOn, /^\d{4}-\d{2}-\d{2}$/);
    }
  }
});

test('the freshness page names every unconfirmed row with its reason', () => {
  const dataset = {
    ...DATASETS[0],
    unconfirmed: [
      { id: 'bls-row', reason: 'data.bls.gov answered HTTP 503', triedOn: '2026-10-25' },
    ],
  };
  const html = renderToStaticMarkup(
    React.createElement(DatasetTable, { rows: [{ dataset, ageDays: 0, state: 'late' }] }),
  );
  assert.match(html, /Not confirmed/);
  assert.match(html, /bls-row/);
  assert.match(html, /data\.bls\.gov answered HTTP 503 \(tried 2026-10-25\)/);
  const clean = renderToStaticMarkup(
    React.createElement(DatasetTable, {
      rows: [{ dataset: { ...DATASETS[0], unconfirmed: [] }, ageDays: 0, state: 'fresh' }],
    }),
  );
  assert.doesNotMatch(clean, /Not confirmed/);
});
