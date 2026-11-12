/**
 * The quality trend draws one point per day: the run fires every six hours,
 * and chartkit places points by date, so same-day runs would stack.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { latestPerDay } from '../components/quality/Trend';

test("same-day runs become that day's latest, in date order", () => {
  const out = latestPerDay([
    { at: '2026-11-12T06:41:00Z', v: 3 },
    { at: '2026-11-11T18:41:00Z', v: 2 },
    { at: '2026-11-12T00:41:00Z', v: 4 },
    { at: '2026-11-11T00:41:00Z', v: 1 },
  ]);
  assert.deepEqual(
    out.map((p) => p.v),
    [2, 3],
  );
});
