/**
 * `check-series.ts --write` moves a series' date only for the series named,
 * and touches nothing else in the file — a date says "checked" only where the
 * check ran and every quote was found.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { redate } from '../scripts/research/check-series';

const FILE = `{
  "series": [
    {
      "id": "a",
      "checkedOn": "2026-09-24",
      "points": [{ "date": "2025", "value": 1 }]
    },
    {
      "id": "b",
      "checkedOn": "2026-09-24",
      "points": []
    }
  ]
}
`;

test('only the named series is re-dated, byte for byte elsewhere', () => {
  const out = redate(FILE, new Set(['b']), '2026-10-25');
  assert.equal(out, FILE.replace(/("id": "b",\n\s+"checkedOn": ")2026-09-24/, '$12026-10-25'));
  assert.match(out, /"id": "a",\n\s+"checkedOn": "2026-09-24"/);
});

test('nothing named, nothing changed; an unknown id is an error, not a silent skip', () => {
  assert.equal(redate(FILE, new Set(), '2026-10-25'), FILE);
  assert.throws(() => redate(FILE, new Set(['c']), '2026-10-25'), /series c/);
});
