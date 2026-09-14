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
import { PORTAL_NAV } from '../components/portal/Shell';
import { sitePages } from '../config/site-content';

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
    if (b.counts.sourced === 0 && b.counts.candidate === 0)
      assert.equal(b.state, 'unverified', b.name);
  }
  const totals = portalTotals();
  assert.equal(
    totals.producers,
    COVERAGE.reduce((n, e) => n + e.producers.length, 0),
  );
});

test('the board narrows by curve through the URL and an empty query is the whole board', () => {
  const all = applyQuery(BOTTLENECKS, BOARD_SPEC, parseQuery({}, BOARD_SPEC));
  assert.equal(all.rows.length, BOTTLENECKS.length);

  const query = parseQuery({ curve: 'actuation' }, BOARD_SPEC);
  const narrowed = applyQuery(BOTTLENECKS, BOARD_SPEC, query);
  assert.ok(narrowed.rows.length > 0);
  assert.ok(narrowed.rows.every((b) => b.curve === 'actuation'));

  const qs = writeQuery({}, query, BOARD_SPEC).toString();
  assert.equal(qs, 'curve=actuation');
});

test('the portal nav points only at routes that exist', () => {
  const documentPaths = new Set(sitePages().map((p) => p.path));
  const portalPaths = new Set(['', 'research']);
  for (const item of PORTAL_NAV) {
    assert.ok(
      documentPaths.has(item.path) || portalPaths.has(item.path),
      `nav points at missing ${item.path}`,
    );
  }
});
