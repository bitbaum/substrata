/**
 * Data series: the corpus is well-formed, and the arithmetic on it is right.
 *
 * The integrity half is the site's rule written as a test — a point with no
 * source, no quote or no period is a number nobody can check, and one on a
 * bottleneck that does not exist links to a 404.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { OFFICIAL_SERIES } from '../config/substrata-official-series';
import { BOTTLENECKS } from '../lib/bottlenecks';
import { seriesItems } from '../lib/desk-series';
import {
  corpusSeries,
  effectOf,
  formatPct,
  latestChange,
  periodLabel,
  periodTime,
  seriesCsv,
  sortPoints,
  type Series,
} from '../lib/series';
import { geometry, niceStep } from '../lib/series-chart';
import { parseBls, toSeries } from '../lib/series-store';

const SLUGS = new Set(BOTTLENECKS.map((b) => b.slug));
const PERIOD = /^\d{4}(-Q[1-4]|-\d{2}(-\d{2})?)?$/;

test('every corpus point is dated, sourced, quoted and on a real bottleneck', () => {
  const ids = new Set<string>();
  for (const s of corpusSeries()) {
    assert.ok(!ids.has(s.id), `duplicate series id ${s.id}`);
    ids.add(s.id);
    assert.ok(SLUGS.has(s.bottleneck), `${s.id}: unknown bottleneck ${s.bottleneck}`);
    assert.ok(s.unit && s.metric && s.geography, `${s.id}: metric, unit and geography required`);
    assert.ok(s.check.length > 10 && /^\d{4}-\d{2}-\d{2}$/.test(s.checkedOn), `${s.id}: check`);
    assert.ok(s.points.length > 0, `${s.id}: no points`);
    const periods = new Set<string>();
    for (const p of s.points) {
      assert.match(p.date, PERIOD, `${s.id}: bad period ${p.date}`);
      assert.ok(!periods.has(p.date), `${s.id}: two values for ${p.date}`);
      periods.add(p.date);
      assert.ok(Number.isFinite(p.value), `${s.id} ${p.date}: value`);
      assert.match(p.source, /^https?:\/\//, `${s.id} ${p.date}: source`);
      assert.ok((p.quote ?? '').length >= 8, `${s.id} ${p.date}: no quote`);
      assert.ok(p.publisher.length > 2, `${s.id} ${p.date}: publisher`);
    }
  }
});

test('official series map to real bottlenecks and unique ids', () => {
  const ids = OFFICIAL_SERIES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of OFFICIAL_SERIES) assert.ok(SLUGS.has(s.bottleneck), s.id);
  const corpusIds = new Set(corpusSeries().map((s) => s.id));
  for (const id of ids) assert.ok(!corpusIds.has(id), `${id} collides with a corpus series`);
});

test('periods order and read correctly', () => {
  const order = ['2024', '2024-Q3', '2024-10', '2024-11-02', '2025-Q1'];
  assert.deepEqual(
    [...order].reverse().sort((a, b) => periodTime(a) - periodTime(b)),
    order,
  );
  assert.equal(periodLabel('2025-Q2'), 'Q2 2025');
  assert.equal(periodLabel('2026-08'), 'Aug 2026');
  assert.equal(periodLabel('2026-03-03'), '3 Mar 2026');
  assert.ok(Number.isNaN(periodTime('last year')));
});

const pt = (date: string, value: number) => ({
  date,
  value,
  source: 'https://example.org/',
  publisher: 'Example',
  primary: true,
  quote: 'quoted sentence',
});

function fake(values: [string, number][], direction: Series['direction'] = 'up-tightens'): Series {
  return {
    id: 'x',
    bottleneck: 'gallium-refined',
    metric: 'Gallium price',
    unit: 'USD/kg',
    geography: 'US',
    kind: 'price',
    direction,
    origin: 'corpus',
    check: 'checked by a test',
    checkedOn: '2026-09-24',
    points: sortPoints(values.map(([d, v]) => pt(d, v))),
  };
}

test('change is against the prior point, signed, and read by direction', () => {
  const s = fake([
    ['2024', 100],
    ['2025', 112],
  ]);
  const change = latestChange(s);
  assert.ok(change);
  assert.equal(change.pct?.toFixed(2), '0.12');
  assert.equal(formatPct(change.pct ?? 0), '+12%');
  assert.equal(formatPct(-0.034), '−3.4%');
  assert.equal(effectOf(s, change), 'tightens');
  assert.equal(effectOf({ direction: 'up-loosens' }, change), 'loosens');
  assert.equal(latestChange(fake([['2025', 1]])), undefined);
});

test('CSV escapes quotes and commas and keeps provenance on every row', () => {
  const s = fake([['2025', 5]]);
  s.points[0].quote = 'He said "5", then left';
  const csv = seriesCsv(s).trim().split('\n');
  assert.equal(csv.length, 2);
  assert.match(csv[1], /"He said ""5"", then left"/);
  assert.match(csv[1], /https:\/\/example\.org\//);
});

test('chart geometry spans the data on round ticks, and never divides by zero', () => {
  assert.equal(niceStep(100, 3), 50);
  assert.equal(niceStep(7, 3), 5);
  const g = geometry(
    fake([
      ['2020', 400],
      ['2022', 475],
    ]).points,
  );
  assert.ok(g.min <= 400 && g.max >= 475);
  assert.equal(g.placed[0].x, 0);
  assert.equal(g.placed[1].x, 100);
  for (const t of g.ticks) assert.ok(t.y >= 0 && t.y <= 100);
  const flat = geometry(fake([['2020', 3]]).points);
  assert.ok(Number.isFinite(flat.placed[0].y));
});

test('BLS rows parse to months, skip the annual average, and keep the preliminary flag', () => {
  const parsed = parseBls([
    { year: '2026', period: 'M08', value: '475.065', footnotes: [{ code: 'P' }] },
    { year: '2025', period: 'M13', value: '460.0' },
    { year: '2026', period: 'M07', value: '-' },
    { year: '2026', period: 'M06', value: '470.1', footnotes: [{}] },
  ]);
  assert.deepEqual(parsed, [
    { period: '2026-08', value: 475.065, preliminary: true },
    { period: '2026-06', value: 470.1, preliminary: false },
  ]);
  const s = toSeries(
    OFFICIAL_SERIES[0],
    [{ period: '2026-08', value: 475, preliminary: true, first_seen: new Date(0) }],
    '2026-09-24',
  );
  assert.equal(s.origin, 'official');
  assert.match(s.points[0].source, /data\.bls\.gov\/timeseries\//);
});

test('the desk hears the newest point and every big move, only on the reader’s rails', () => {
  const s = fake([
    ['2022', 100],
    ['2023', 150],
    ['2024', 155],
    ['2025', 160],
  ]);
  const rails = new Map([['gallium-refined', 'Gallium, refined']]);
  const items = seriesItems([s], rails);
  assert.deepEqual(
    items.map((i) => i.id),
    ['x:2023', 'x:2025'],
  );
  const moved = items.find((i) => i.id === 'x:2023');
  assert.ok(moved && moved.source === 'series' && moved.moved);
  assert.equal(moved.effect, 'tightens');
  assert.match(moved.title, /\+50% vs 2022/);
  assert.deepEqual(seriesItems([s], new Map()), []);
});
