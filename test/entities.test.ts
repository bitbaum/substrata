/**
 * The entity registry is the identity SSOT, so its invariants are build gates.
 *
 * The bugs these exist to stop are ones the corpus has actually had: the same
 * firm spelled two ways living as two records, a section (capital) that existed
 * as pages but was invisible to search and the assistant, and a kind list
 * hand-copied into a page where it silently fell behind.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { allEntities, entitiesOfKind, resolveEntity, resolveIn } from '../lib/entities/registry';
import { ENTITY_KINDS } from '../lib/entities/types';
import { researchDocuments } from '../lib/research-index';

test('every entity id is unique', () => {
  const seen = new Map<string, string>();
  const clashes: string[] = [];
  for (const entity of allEntities()) {
    const previous = seen.get(entity.id);
    if (previous) clashes.push(`${entity.id} used by "${previous}" and "${entity.name}"`);
    seen.set(entity.id, entity.name);
  }
  assert.deepEqual(clashes, [], `Duplicate entity ids:\n  ${clashes.join('\n  ')}`);
});

test('every entity is well formed and kind-scoped', () => {
  const problems: string[] = [];
  for (const entity of allEntities()) {
    if (!entity.id.startsWith(`${entity.kind}:`))
      problems.push(`${entity.id} is not scoped to its kind (${entity.kind})`);
    if (entity.id !== `${entity.kind}:${entity.key}`)
      problems.push(`${entity.id} does not agree with its key "${entity.key}"`);
    if (!entity.name.trim()) problems.push(`${entity.id} has no name`);
    if (!entity.href.startsWith('/')) problems.push(`${entity.id} href is not internal`);
    if (!entity.evidence.trim()) problems.push(`${entity.id} does not say how it is evidenced`);
    if (!entity.summary.trim()) problems.push(`${entity.id} has no summary`);
    if (entity.aka.includes(entity.name))
      problems.push(`${entity.id} lists its own name as an alias`);
  }
  assert.deepEqual(problems, [], `Malformed entities:\n  ${problems.join('\n  ')}`);
});

test('every declared kind is actually adapted', () => {
  // A kind in the union with no adapter is a page that can never be built and a
  // filter that always returns nothing.
  for (const kind of ENTITY_KINDS) {
    assert.ok(entitiesOfKind(kind).length > 0, `kind "${kind}" is declared but has no entities`);
  }
});

test('capital providers are in the corpus projection', () => {
  // They were not, so a sourced development bank could not be found by search
  // and the assistant could not cite one.
  const capital = entitiesOfKind('capital');
  assert.ok(capital.length > 0, 'no capital entities');
  const documents = researchDocuments();
  for (const provider of capital) {
    assert.ok(
      documents.some((d) => d.id === provider.id),
      `${provider.name} is missing from the research projection`,
    );
  }
});

test('the search projection and the registry cannot drift', () => {
  const entities = allEntities();
  const documents = researchDocuments();
  assert.equal(documents.length, entities.length, 'projection dropped or invented rows');
  for (const entity of entities) {
    const document = documents.find((d) => d.id === entity.id);
    assert.ok(document, `${entity.id} is missing from researchDocuments()`);
    assert.equal(document.title, entity.name, `${entity.id} title disagrees`);
    assert.equal(document.href, entity.href, `${entity.id} href disagrees`);
    assert.equal(document.kind, entity.kind, `${entity.id} kind disagrees`);
  }
});

test('an entity resolves by id, by key and by name', () => {
  const sample = entitiesOfKind('company')[0];
  assert.ok(sample, 'no company entities to check');
  assert.equal(resolveEntity(sample.id)?.id, sample.id);
  assert.equal(resolveIn('company', sample.key)?.id, sample.id);
  // Case-insensitively by name, which is how a policy proponent and a directory
  // row that differ only in capitalisation stay the same organisation.
  assert.equal(resolveIn('company', sample.name.toUpperCase())?.id, sample.id);
  assert.equal(resolveEntity('company:does-not-exist'), undefined);
});
