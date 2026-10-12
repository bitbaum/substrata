/**
 * A chain as a route: the steps in the order material moves, each placed
 * where it is made, the same numbers on the diagram, the globe and the panel.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BOTTLENECKS, bottleneckBySlug } from '../lib/bottlenecks';
import { ROUTE_DEPTH, chainRoute, placesLine, whereMade } from '../app/atlas/chain-route';
import { arcOf } from '../components/portal/globe-overlay';

const EUV = bottleneckBySlug('euv-lithography-scanners')!;

test('EUV: optics and tin go into the scanners, which hold up foundries and then packaging', () => {
  const r = chainRoute(EUV);
  const byName = (n: string) => r.steps.find((s) => s.name.startsWith(n))!;
  assert.equal(byName('EUV lithography scanners').level, 0);
  assert.equal(byName('EUV projection optics').level, -1);
  assert.equal(byName('High-purity tin').level, -1);
  assert.equal(byName('Leading-edge foundry').level, 1);
  assert.equal(byName('Advanced packaging').level, 2);
  assert.deepEqual(
    r.steps.map((s) => s.step),
    r.steps.map((_, i) => i + 1),
    'numbered 1..n in reading order',
  );
  const hops = r.hops.map((h) => `${h.from}>${h.to}`);
  for (const h of ['de>nl', 'cn>nl', 'nl>tw']) assert.ok(hops.includes(h), `${h} is drawn`);
  assert.equal(r.stops[0].iso, 'nl', 'the globe faces where the bottleneck is made');
  assert.ok(
    r.parts.some((p) => p.name === 'Carl Zeiss SMT'),
    'part suppliers are named',
  );
});

test('every route reads one way, stays within its depth, and never draws a hop to itself', () => {
  for (const b of BOTTLENECKS) {
    const r = chainRoute(b);
    const level = new Map(r.steps.map((s) => [s.slug, s.level]));
    assert.equal(new Set(r.steps.map((s) => s.slug)).size, r.steps.length, `${b.slug}: unique`);
    assert.ok(
      r.steps.every((s) => Math.abs(s.level) <= ROUTE_DEPTH),
      `${b.slug}: depth`,
    );
    for (const [from, to] of r.edges) {
      assert.ok(level.get(from)! < level.get(to)!, `${b.slug}: ${from} feeds ${to}, left to right`);
    }
    assert.ok(
      r.hops.every((h) => h.from !== h.to),
      `${b.slug}: no hop to itself`,
    );
    assert.ok(
      new Set(r.stops.map((s) => s.iso)).size === r.stops.length,
      `${b.slug}: one label a country`,
    );
  }
});

test('where a step is made: its makers, not the suppliers of its parts', () => {
  assert.deepEqual(whereMade(EUV), ['nl'], 'ASML, not Zeiss in Germany');
  assert.equal(placesLine(['cn', 'pe', 'id', 'my']), 'China, Peru, Indonesia and 1 more');
  assert.equal(placesLine([]), 'No country on record');
});

test('an arc runs from its start to its end and rises only a little', () => {
  const arc = arcOf('nl>tw', [5, 52], [121, 23.7]);
  const n = arc.lift.length;
  const first = [arc.path[0], arc.path[1], arc.path[2]];
  const last = [arc.path[(n - 1) * 3], arc.path[(n - 1) * 3 + 1], arc.path[(n - 1) * 3 + 2]];
  const toVec = ([lon, lat]: number[]) => {
    const [l, p] = [(lon * Math.PI) / 180, (lat * Math.PI) / 180];
    return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
  };
  const close = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  assert.ok(close(first, toVec([5, 52])) && close(last, toVec([121, 23.7])));
  assert.equal(arc.lift[0], 1);
  assert.ok(Math.max(...arc.lift) < 1.09, 'never floats far off the globe');
});
