/**
 * The corpus is going to get much larger, so the lookups have to be indexed.
 *
 * Measured before this guard existed: `allEntities()` cost 22ms per call and
 * every lookup called it and then linear-scanned the result, so one entity
 * lookup cost 19ms. That is invisible at 268 entities and fatal at ten times
 * that — the cost is the rebuild multiplied by the scan, so it grows with the
 * square of the corpus while feeling fine right up until it does not.
 *
 * These tests guard the structure rather than a stopwatch reading, because a
 * timing assertion alone is flaky on a shared runner. The time bounds here are
 * deliberately generous: they are set to catch a return to linear scanning,
 * which is orders of magnitude, not a few percent of drift.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  allEntities,
  entitiesOfKind,
  indexStats,
  resolveEntity,
  resolveIn,
} from '../lib/entities/registry';
import { connectionsOf, relationStats } from '../lib/relations/registry';

test('the corpus is built once, not per call', () => {
  // Identity, not equality: a fresh array each call means a fresh build.
  assert.equal(allEntities(), allEntities(), 'allEntities() rebuilds the corpus every call');
  assert.equal(entitiesOfKind('company'), entitiesOfKind('company'), 'kind lookup rebuilds');
});

test('an entity lookup does not scan the corpus', () => {
  const ids = allEntities().map((e) => e.id);
  assert.ok(ids.length > 100, 'corpus too small for this guard to mean anything');
  const started = performance.now();
  for (let round = 0; round < 50; round += 1) {
    for (const id of ids) assert.ok(resolveEntity(id));
  }
  const elapsed = performance.now() - started;
  // Linear scanning made this ~250,000ms. Indexed it is ~40ms.
  assert.ok(elapsed < 4000, `${ids.length * 50} lookups took ${Math.round(elapsed)}ms`);
});

test('a connection lookup does not scan the whole web', () => {
  const ids = allEntities().map((e) => e.id);
  const started = performance.now();
  for (let round = 0; round < 50; round += 1) {
    for (const id of ids) connectionsOf(id);
  }
  const elapsed = performance.now() - started;
  assert.ok(elapsed < 4000, `${ids.length * 50} connection lookups took ${Math.round(elapsed)}ms`);
});

test('indexing did not change what the registry answers', () => {
  // The fast path has to agree with the slow one it replaced.
  const all = allEntities();
  for (const entity of all) {
    assert.equal(resolveEntity(entity.id)?.id, entity.id, `${entity.id} lost by id`);
    assert.equal(resolveIn(entity.kind, entity.key)?.id, entity.id, `${entity.id} lost by key`);
    assert.equal(
      resolveIn(entity.kind, entity.name.toUpperCase())?.id,
      entity.id,
      `${entity.id} lost by name`,
    );
  }
  const counted = all.filter((e) => e.kind === 'company').length;
  assert.equal(entitiesOfKind('company').length, counted, 'kind index disagrees with the corpus');
  assert.equal(resolveEntity('company:not-a-real-company'), undefined);
});

test('the index reports what it holds', () => {
  // A data engine that cannot say how much data it is holding is hard to trust
  // and harder to operate.
  const entities = indexStats();
  const relations = relationStats();
  assert.equal(entities.entities, allEntities().length);
  assert.ok(entities.kinds > 0 && entities.labels >= entities.entities);
  assert.ok(relations.relations > 0);
  assert.ok(
    relations.endpoints > 0 && relations.endpoints <= entities.entities,
    'every endpoint should be an entity',
  );
});
