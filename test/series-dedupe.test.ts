/**
 * One metric, one series; and a move too small to read is not read.
 *
 * "Average transformer lead time (US), weeks" and "Power transformer average
 * lead time (Wood Mackenzie), weeks" were the same survey in two series, so
 * the bottleneck showed 128 weeks with no history beside a 50 → 120 chart.
 * They are one series now. The guard below makes the next such split a
 * decision: a single-point series that shares bottleneck, unit, geography
 * and kind with another has to be listed here as genuinely distinct.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MIN_MOVE_PCT,
  changeBetween,
  corpusSeries,
  effectOf,
  isSmallMove,
  type SeriesPoint,
} from '../lib/series';

/** Groups reviewed on 2026-09-25: same unit and place, different metric. */
const DISTINCT = new Set([
  // Average, range, and GSU-only lead times are different measures.
  'large-power-transformer-slots|weeks|US|lead-time',
  // Deficit, import share, domestic share, demand growth.
  'large-power-transformer-slots|%|US|other',
  // Power vs GSU unit cost, and all-transformer price since 2020.
  'large-power-transformer-slots|%|US|price',
  // GOES only vs all electrical steel (amorphous included).
  'grain-oriented-electrical-steel-goes|tonnes/year|US|other',
  'grain-oriented-electrical-steel-goes|%|US|other',
  // Quarter-end spot, long-term, and an annual average.
  'uranium-conversion-and-enrichment|USD/kgU|North America|price',
  // 2019 annual order intake vs quarterly net bookings.
  'euv-lithography-scanners|EUR bn|company: ASML|orders',
  // One series per node.
  'leading-edge-foundry-capacity|%|company: TSMC|other',
  'advanced-packaging-capacity|%|company: TSMC|capacity',
  // Different shares of different totals.
  'high-bandwidth-memory-stacking-yield|%|World|other',
  'high-bandwidth-memory-stacking-yield|%|company: SK hynix|other',
  'semiconductor-process-engineers|people|United States|workforce',
  'semiconductor-process-engineers|%|United States|workforce',
  // All employees vs professionals.
  'semiconductor-process-engineers|people|company: TSMC|workforce',
  // One series per resist or substrate type.
  'photoresist-formulation|%|World|other',
  'silicon-carbide-substrate-200-mm-semi-insulating|%|World|other',
]);

test('a single-point series sharing unit, place and kind with another is reviewed as distinct', () => {
  const groups = new Map<string, { id: string; points: number }[]>();
  for (const s of corpusSeries()) {
    const key = [s.bottleneck, s.unit, s.geography, s.kind].join('|');
    groups.set(key, [...(groups.get(key) ?? []), { id: s.id, points: s.points.length }]);
  }
  const unreviewed = [...groups.entries()]
    .filter(([key, g]) => g.length > 1 && g.some((s) => s.points === 1) && !DISTINCT.has(key))
    .map(([key, g]) => `${key}: ${g.map((s) => s.id).join(', ')}`);
  assert.deepEqual(unreviewed, [], 'merge into one series, or list the group as distinct');
  const stale = [...DISTINCT].filter((key) => !groups.has(key));
  assert.deepEqual(stale, [], 'a reviewed group no longer exists — delete its entry');
});

test('the transformer lead time is one series with its history', () => {
  const ids = corpusSeries().map((s) => s.id);
  assert.ok(!ids.includes('average-transformer-lead-time'), 'the duplicate is back');
  const merged = corpusSeries().find((s) => s.id === 'power-transformer-average-lead-time');
  assert.deepEqual(
    merged?.points.map((p) => [p.date, p.value]),
    [
      ['2021', 50],
      ['2024', 120],
      ['2025-Q2', 128],
    ],
  );
});

const point = (date: string, value: number): SeriesPoint => ({
  date,
  value,
  source: 'https://example.org',
  publisher: 'x',
  primary: true,
});

test('a move under the threshold is flat; at or over it, it is called', () => {
  const up = { direction: 'up-tightens' as const };
  const small = changeBetween(point('2024', 128), point('2025', 126));
  assert.ok(Math.abs(small.pct!) < MIN_MOVE_PCT);
  assert.equal(isSmallMove(small), true);
  assert.equal(effectOf(up, small), 'neutral');
  const big = changeBetween(point('2024', 100), point('2025', 100 * (1 - MIN_MOVE_PCT)));
  assert.equal(isSmallMove(big), false);
  assert.equal(effectOf(up, big), 'loosens');
  const offZero = changeBetween(point('2024', 0), point('2025', 1));
  assert.equal(isSmallMove(offZero), false, 'a move off zero has no % and is never small');
  assert.equal(effectOf(up, offZero), 'tightens');
});
