/**
 * The loops are the KPI, so the traversal to them is a gate.
 *
 * The site's model is that technology improves at the speed of the slowest
 * loop — design, build, measure — so the question worth asking of any entity is
 * which loop it holds up and through what. These tests hold the traversal
 * honest in both directions: that it reaches, and that it never quietly turns
 * dated judgements into a measurement.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loopSummary, loops, rolesIn, rolesOf } from '../lib/kpi/loops';
import { entitiesOfKind } from '../lib/entities/registry';

test('every loop is gated by bottlenecks that exist', () => {
  const all = loops();
  assert.ok(all.length > 0, 'no loops');
  const slugs = new Set(entitiesOfKind('bottleneck').map((e) => e.id));
  for (const loop of all) {
    assert.ok(loop.period.trim(), `${loop.id} has no period`);
    for (const gate of loop.gates) {
      assert.ok(slugs.has(gate.entity.id), `${loop.id} gated by unknown ${gate.entity.id}`);
      assert.ok(gate.binding >= 0 && gate.binding <= 12, 'severity is a 0-12 judgement');
      assert.ok(gate.judgedOn, 'a judgement with no date is not reviewable');
    }
  }
});

test('severity judgements are never added together', () => {
  // A composite of dated judgements reads as a measurement of the world and is
  // not one. The loop reports the WORST single judgement, so it can only ever
  // equal one of its gates.
  for (const loop of loops()) {
    if (loop.gates.length === 0) continue;
    const bindings = loop.gates.map((g) => g.binding);
    assert.ok(
      bindings.includes(loop.worstBinding),
      `${loop.id}: worstBinding ${loop.worstBinding} is not any single gate's judgement`,
    );
    assert.equal(loop.worstBinding, Math.max(...bindings));
  }
  const summary = loopSummary();
  assert.ok(summary.worstBinding <= 12, 'the summary invented a score above the scale');
  assert.ok(summary.blocked <= summary.loops);
});

test('a bottleneck gates its loops directly', () => {
  const goes = entitiesOfKind('bottleneck').find(
    (e) => e.key === 'grain-oriented-electrical-steel-goes',
  );
  assert.ok(goes, 'GOES should be in the corpus');
  const roles = rolesOf(goes.id);
  assert.ok(roles.length > 0, 'GOES gates no loop');
  for (const role of roles) {
    assert.equal(role.through.id, goes.id, 'a bottleneck reaches loops as itself');
    assert.equal(role.via, 'is the constraint');
  }
});

test('everything else reaches the loops through a bottleneck, carrying the join evidence', () => {
  // This is the whole claim: a company matters because of what it makes, and
  // the strength of that claim is the strength of the join.
  const roles = rolesIn('company', 'posco');
  assert.ok(roles.length > 0, 'POSCO should hold up at least one loop');
  for (const role of roles) {
    assert.equal(role.through.kind, 'bottleneck', 'the path must run through a bottleneck');
    assert.notEqual(role.through.id, 'company:posco');
    assert.ok(role.via.trim(), 'the path does not say how it connects');
    assert.ok(role.evidence.trim(), 'the path does not say how well the join is evidenced');
  }
  // POSCO makes GOES, and that is a sourced join.
  assert.ok(
    roles.some((r) => r.evidence === 'sourced'),
    'expected a sourced path',
  );
});

test('an entity connected to nothing holds up nothing, rather than erroring', () => {
  assert.deepEqual(rolesOf('company:not-a-real-company'), []);
  const learn = entitiesOfKind('learn')[0];
  assert.deepEqual(rolesOf(learn.id), [], 'an explainer gates no loop');
});

test('the same loop is never reached twice through the same bottleneck', () => {
  for (const kind of ['company', 'capital', 'science'] as const) {
    for (const entity of entitiesOfKind(kind).slice(0, 25)) {
      const seen = new Set<string>();
      for (const role of rolesOf(entity.id)) {
        const at = `${role.loop.id}:${role.through.id}`;
        assert.ok(!seen.has(at), `${entity.id} reports ${at} twice`);
        seen.add(at);
      }
    }
  }
});
