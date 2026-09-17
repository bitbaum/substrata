/**
 * The joins are the product, so their invariants are build gates.
 *
 * Substrata's claim is that these constraints are connected — a firm makes a
 * material, a rule slows the firm, a mandate could fund relief. A web is only
 * worth reading if every strand resolves, says which direction it is read in,
 * and admits how well it is evidenced.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { allEntities, resolveEntity } from '../lib/entities/registry';
import { allRelations, connectionsOf } from '../lib/relations/registry';
import { RELATION_KINDS, RELATION_LABEL } from '../lib/relations/types';
import { neighbors } from '../lib/graph';

test('every relation joins two entities that exist', () => {
  // A dangling join is worse than a missing one: it renders as a fact and
  // leads nowhere.
  const broken: string[] = [];
  for (const relation of allRelations()) {
    if (!resolveEntity(relation.from))
      broken.push(`${relation.kind}: no such entity ${relation.from}`);
    if (!resolveEntity(relation.to)) broken.push(`${relation.kind}: no such entity ${relation.to}`);
  }
  assert.deepEqual(broken, [], `Dangling relations:\n  ${broken.join('\n  ')}`);
});

test('every relation says how well the join itself is evidenced', () => {
  // Not how well either END is: a sourced company and a sourced material can
  // still be joined by nothing but a directory guess.
  for (const relation of allRelations()) {
    assert.ok(
      relation.evidence.trim().length > 0,
      `${relation.kind} ${relation.from} → ${relation.to} claims nothing about its evidence`,
    );
  }
});

test('a sourced producer row makes a sourced join, and an unverified one does not', () => {
  const produces = allRelations().filter((r) => r.kind === 'produces');
  assert.ok(produces.length > 0, 'no producer joins');
  const sourced = produces.filter((r) => r.evidence === 'sourced');
  assert.ok(sourced.length > 0, 'no sourced producer joins');
  // Every sourced join carries the source it is sourced to.
  for (const relation of sourced) {
    assert.ok(
      relation.sources.length > 0,
      `${relation.from} → ${relation.to} says sourced with no source`,
    );
  }
  // And the unverified ones are still present, distinguishable rather than hidden.
  assert.ok(
    produces.some((r) => r.evidence !== 'sourced'),
    'unverified producer rows should still appear, labelled',
  );
});

test('a relation is declared once and reads correctly from both ends', () => {
  // `makes` and `produced by` were separate declarations before, so they could
  // disagree. They are one fact now.
  const sample = allRelations().find((r) => r.kind === 'produces');
  assert.ok(sample, 'no producer relation to check');
  const forward = connectionsOf(sample.from).find((c) => c.other === sample.to);
  const inverse = connectionsOf(sample.to).find((c) => c.other === sample.from);
  assert.ok(forward && inverse, 'the relation is not visible from both ends');
  assert.equal(forward.label, RELATION_LABEL.produces.forward);
  assert.equal(inverse.label, RELATION_LABEL.produces.inverse);
  assert.equal(forward.evidence, inverse.evidence, 'the same join told two evidence stories');
});

test('every relation kind has both labels, and each is used by nothing else', () => {
  const labels = new Set<string>();
  for (const kind of RELATION_KINDS) {
    const { forward, inverse } = RELATION_LABEL[kind];
    for (const label of [forward, inverse]) {
      assert.ok(label.trim().length > 0, `${kind} is missing a direction label`);
      assert.ok(!labels.has(label), `"${label}" is used by more than one relation kind`);
      labels.add(label);
    }
  }
});

test('a policy instrument is a policy node, not a capital one', () => {
  // The old graph emitted instruments with `kind: 'capital'`, so rules rendered
  // as capital on a country dossier.
  const policyJoins = allRelations().filter((r) => r.kind === 'in-force-in');
  assert.ok(policyJoins.length > 0, 'no policy jurisdiction joins');
  for (const relation of policyJoins) {
    assert.ok(relation.from.startsWith('policy:'), `${relation.from} should be a policy entity`);
    assert.ok(relation.to.startsWith('country:'), `${relation.to} should be a country entity`);
  }
});

test('the graph adapter resolves labels from the registry', () => {
  // A country used to render as its ISO code because the graph built its own
  // labels instead of asking the registry.
  const company = allEntities().find((e) => e.kind === 'company' && e.key === 'posco');
  assert.ok(company, 'POSCO should be in the corpus');
  const edges = neighbors('company', company.key);
  assert.ok(edges.length > 0, 'POSCO should have edges');
  for (const edge of edges) {
    assert.notEqual(edge.to.label, edge.to.id.toUpperCase(), 'label looks like a raw code');
    assert.ok(edge.evidence.length > 0, 'graph edge lost its evidence');
  }
});
