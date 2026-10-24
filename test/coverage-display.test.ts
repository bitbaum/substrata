/**
 * What a reader sees of a coverage result (lib/coverage/display.ts): a bounded
 * headline, a flag naming the row behind an implausible ratio, and a group
 * row's places one per line — on the real research files, data unaltered.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dominantRow, exactRatio, headline, splitLocations } from '../lib/coverage/display';
import { coverageFor } from '../lib/coverage/ratio';

test('the headline is bounded at ≥100%, and the exact ratio is kept for the working', () => {
  assert.deepEqual(headline(0.61), { value: '61%', note: null });
  assert.equal(headline(1).value, '≥100%');
  assert.match(headline(8.52).note!, /capacity can exceed output/);
  assert.equal(exactRatio(24000 / 21109), '113.7%');
});

test('an implausible ratio names the printed row that dominates it, and changes no number', () => {
  const ca = coverageFor('ca', 'nickel');
  assert.equal(ca.status, 'computed');
  const d = dominantRow(ca)!;
  assert.match(d.row.location, /Lac des Iles/);
  assert.equal(d.row.printed, '800');
  assert.match(d.note, /Check the row: one printed figure dominates/);
  if (ca.status === 'computed') assert.equal(ca.named.capacity, 1065000, 'the figure stays in');

  const cn = dominantRow(coverageFor('cn', 'cobalt'))!;
  assert.ok(cn.row.operators.some((o) => /Jinchuan/.test(o.name)));
  // A plausible ratio carries no flag.
  assert.equal(dominantRow(coverageFor('kz', 'uranium')), null);
});

test('a "Locations:" cell is one place per line; any other cell is one place', () => {
  const kz = coverageFor('kz', 'uranium');
  const group = kz.rows.find((r) => r.printed === '24000')!;
  const places = splitLocations(group.location);
  assert.equal(places.length, 16);
  assert.match(places[0], /^Blocks 1, 3, and 4 of the Budenovskoe deposit/);
  assert.equal(places.join(' '), group.location.replace(/^Locations:\s*/, ''), 'nothing dropped');
  assert.deepEqual(
    splitLocations('Camp Tembo, Mukuku, and other mines in Maniema Province Maniema Province'),
    ['Camp Tembo, Mukuku, and other mines in Maniema Province Maniema Province'],
  );
});
