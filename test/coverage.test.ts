/**
 * The coverage ratio (lib/coverage): capacity cells read without guessing,
 * units converted only by exact factors, a group capacity counted once, and
 * every result carrying its basis — on the real research files.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readRow, rowMatches, specsFor } from '../lib/coverage/basis';
import { figureFor, parseCapacity } from '../lib/coverage/capacity';
import { coverageFor, coverageOf, RATIO_LABEL } from '../lib/coverage/ratio';
import { distinctRows } from '../lib/coverage/rows';
import { convert } from '../lib/coverage/units';
import { isCounted } from '../lib/graph/index';
import { buildStore, graphStore } from '../lib/graph/store';
import { RELATIONS } from '../config/substrata-relations';
import { facilitiesFor } from '../lib/resources/producers';

test('a capacity cell is read as printed, and nothing unclear becomes a number', () => {
  assert.deepEqual(parseCapacity('24000'), {
    kind: 'number',
    printed: '24000',
    value: 24000,
    estimated: false,
  });
  assert.equal((parseCapacity('3,700') as { value: number }).value, 3700);
  const est = parseCapacity('1,200.e') as { value: number; estimated: boolean };
  assert.deepEqual([est.value, est.estimated], [1200, true]);
  assert.equal((parseCapacity('2,300e') as { estimated: boolean }).estimated, true);
  assert.equal(parseCapacity('NA').kind, 'not-printed');
  assert.equal(parseCapacity('').kind, 'not-printed');
  assert.equal(parseCapacity('Unavailable').kind, 'not-printed');
  for (const two of ['2200 2400', '10 20', '5. 4. 4', '4. NA', '10-20'])
    assert.equal(parseCapacity(two).kind, 'unreadable', two);
  assert.equal(
    parseCapacity('9,999,999 ore, which yields about 99,999 copper in concentrate').kind,
    'unreadable',
  );
  assert.equal(parseCapacity('170 concentrates 300 smelter, 25 SX–EW,2').kind, 'unreadable');
});

test('a cell naming forms gives a figure only for the material itself', () => {
  const parts = parseCapacity('12,000e copper; 2,000e cobalt');
  assert.deepEqual(figureFor(parts, 'copper'), { value: 12000, estimated: true });
  assert.deepEqual(figureFor(parts, 'cobalt'), { value: 2000, estimated: true });
  assert.match(
    (figureFor(parseCapacity('10 (metal)'), 'copper') as { reason: string }).reason,
    /metal/,
  );
  assert.match(
    (figureFor(parseCapacity('99,999 copper cathode'), 'copper') as { reason: string }).reason,
    /copper cathode/,
  );
  assert.match((figureFor(parseCapacity('NA'), 'copper') as { reason: string }).reason, /NA/);
});

test('units convert by exact factors within a family, and never across', () => {
  assert.deepEqual(convert(29, 'thousand metric tons', 't'), { value: 29000, factor: 1000 });
  assert.equal((convert(5900, 'kilograms', 't') as { value: number }).value, 5.9);
  assert.equal((convert(13000, 'thousand cubic meters', 'Mcm') as { value: number }).value, 13);
  assert.match(
    (convert(1, 't', 'Mct') as { incomparable: string }).incomparable,
    /different things/,
  );
  assert.match(
    (convert(1, 'troy pounds', 't') as { incomparable: string }).incomparable,
    /not one/,
  );
});

test('Kazakhstan uranium: one capacity printed for sixteen ventures is counted once', () => {
  const c = coverageFor('kz', 'uranium');
  assert.equal(c.status, 'computed');
  if (c.status !== 'computed') return;
  const group = c.rows.find((r) => r.printed === '24000')!;
  assert.ok(group.operators.length >= 16, `${group.operators.length} operators on the group row`);
  assert.equal(c.named.capacity, 24000, 'the group capacity is never repeated per operator');
  assert.equal(c.named.rows, 1);
  assert.equal(c.national.source, 'WNA');
  assert.equal(c.national.value, 21109);
  assert.equal(c.national.year, 2023);
  assert.equal(c.yearGap, 0);
  assert.equal(c.ratio, 24000 / 21109);
  assert.equal(c.ratioLabel, RATIO_LABEL);
  assert.match(c.caveat, /not a share of output/);
  // The rare-earth plant filed under uranium measures something else, and says so.
  const ree = c.rows.find((r) => /Stepnogorsk/.test(r.location))!;
  assert.equal(typeof ree.compared, 'string');
  // A printed line filed twice is one line.
  const rows = facilitiesFor('kz', 'uranium')!.rows;
  assert.equal(distinctRows([...rows, ...rows]).length, rows.length);
});

test('a thousand-tons table is converted into the national unit by the exact factor', () => {
  const c = coverageFor('ca', 'nickel');
  assert.equal(c.status, 'computed');
  if (c.status !== 'computed') return;
  assert.equal(c.unit, 't');
  const raglan = c.rows.find((r) => /Raglan/.test(r.location))!;
  assert.equal(raglan.unit, 'thousand metric tons');
  assert.equal(raglan.printed, '29');
  assert.deepEqual(raglan.figure, { value: 29000, estimated: false });
});

test('an incomparable basis, and a country with no table, say why instead of a ratio', () => {
  const li = coverageFor('cn', 'lithium');
  assert.equal(li.status, 'cannot');
  if (li.status === 'cannot') assert.match(li.reason, /chemical factor, not a unit factor/);
  const us = coverageFor('us', 'uranium');
  assert.equal(us.status, 'cannot');
  if (us.status === 'cannot') assert.match(us.reason, /no USGS Minerals Yearbook facility table/);
  // A row that names the content but not the stage is not mine output when refinery is published too.
  const spec = specsFor('copper')[0];
  assert.notEqual(rowMatches(readRow('', 'Copper, Cu content:—'), spec, false), true);
  assert.equal(rowMatches(readRow('', 'Mine, Cu content'), spec, false), true);
  assert.equal(
    rowMatches(readRow('Nickel, Ni content', 'Mine'), specsFor('nickel')[0], false),
    true,
  );
});

test('every result carries its basis or its reason, and its sources', () => {
  for (const iso2 of ['kz', 'cn', 'ne', 'us']) {
    for (const c of coverageOf(iso2)) {
      if (c.status === 'computed') {
        assert.ok(c.basis && c.national.url && c.table?.url, `${iso2} ${c.resource}`);
        assert.ok(Number.isFinite(c.ratio));
      } else assert.ok(c.reason.length > 10, `${iso2} ${c.resource}`);
    }
  }
});

test('rule proposals never move a coverage number', () => {
  const s = graphStore();
  assert.ok(s.proposals.length > 0);
  assert.ok(
    s.proposals.every((r) => !isCounted(r) && (r.grade === 'derived' || r.grade === 'lead')),
  );
  const without = buildStore({ hand: RELATIONS, derived: { relations: [] } });
  for (const iso2 of ['kz', 'cn', 'ca']) {
    const a = coverageOf(iso2, s).map((c) => JSON.stringify(c));
    const b = coverageOf(iso2, without).map((c) => JSON.stringify(c));
    assert.deepEqual(a, b, iso2);
  }
});

test('coverage_of answers with the computed ratio, its label and its sources', async () => {
  const { runTool } = await import('../lib/chat-tools/registry');
  const env = {
    ledger: { records: new Map(), leads: [], web: [], trail: [], tables: [] },
  } as unknown as Parameters<typeof runTool>[2];
  const out = JSON.parse(
    (await runTool('coverage_of', { country: 'Kazakhstan', resource: 'uranium' }, env)).result,
  );
  const u = out.resources[0];
  assert.equal(u.computed, true);
  assert.equal(u.ratio_is, RATIO_LABEL);
  assert.match(u.sources.national.url, /world-nuclear\.org/);
  assert.match(u.sources.facilities.url, /usgs\.gov/);
});
