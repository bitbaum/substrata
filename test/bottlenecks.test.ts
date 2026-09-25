/**
 * The board joins two files into one list. It must lose nothing, name
 * nothing twice, and narrow the way the URL says.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyQuery, parseQuery, writeQuery } from 'listkit';

import { MATERIALS } from '../config/substrata';
import { CHOKEPOINTS, COVERAGE } from '../config/substrata-coverage';
import { RESEARCH_PROGRAMMES } from '../config/substrata-programmes';
import {
  BOARD_SPEC,
  BOTTLENECKS,
  bottleneckBySlug,
  portalTotals,
  slugOf,
} from '../lib/bottlenecks';

test('every material and every chokepoint is on the board exactly once', () => {
  assert.equal(BOTTLENECKS.length, MATERIALS.length + CHOKEPOINTS.length);
  const slugs = BOTTLENECKS.map((b) => b.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'two bottlenecks share a slug');
  for (const material of MATERIALS)
    assert.ok(bottleneckBySlug(slugOf(material.title)), material.title);
  for (const point of CHOKEPOINTS) assert.ok(bottleneckBySlug(slugOf(point.name)), point.name);
});

test('every row the programme cites has a page on the portal', () => {
  for (const programme of RESEARCH_PROGRAMMES) {
    for (const layer of programme.layers) {
      for (const name of layer.gatedBy) {
        assert.ok(bottleneckBySlug(slugOf(name)), `${layer.id} links to a missing page: ${name}`);
      }
    }
  }
});

test('a bottleneck is sourced only when every producer is', () => {
  for (const b of BOTTLENECKS) {
    if (b.state === 'sourced') assert.equal(b.counts.sourced, b.counts.total, b.name);
    if (b.counts.sourced === 0) assert.equal(b.state, 'unverified', b.name);
  }
  const totals = portalTotals();
  assert.equal(
    totals.producers,
    COVERAGE.reduce((n, e) => n + e.producers.length, 0) +
      CHOKEPOINTS.reduce((n, c) => n + c.holders.length, 0),
  );
});

test('the board narrows by stage and horizon through the URL and an empty query is the whole board', () => {
  const all = applyQuery(BOTTLENECKS, BOARD_SPEC, parseQuery({}, BOARD_SPEC));
  assert.equal(all.rows.length, BOTTLENECKS.length);

  const query = parseQuery({ stage: 'actuation', horizon: 'now' }, BOARD_SPEC);
  const narrowed = applyQuery(BOTTLENECKS, BOARD_SPEC, query);
  assert.ok(narrowed.rows.length > 0);
  assert.ok(narrowed.rows.every((b) => b.stage === 'actuation' && b.horizon === 'now'));

  const qs = writeQuery({}, query, BOARD_SPEC).toString();
  assert.equal(qs, 'stage=actuation&horizon=now');
});

test('every bottleneck carries its stage, score, horizon and events', () => {
  for (const b of BOTTLENECKS) {
    assert.ok(b.binding >= 0 && b.binding <= 12, b.name);
    assert.ok(['now', 'two-years', 'beyond'].includes(b.horizon), b.name);
    assert.ok(
      b.events.every((e) => e.bottlenecks.includes(b.name)),
      b.name,
    );
  }
  // Default order: by stage, then hardest-binding first.
  for (let i = 1; i < BOTTLENECKS.length; i++) {
    const a = BOTTLENECKS[i - 1];
    const b = BOTTLENECKS[i];
    if (a.stage === b.stage) assert.ok(a.binding >= b.binding, `${a.name} before ${b.name}`);
  }
});
