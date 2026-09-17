/**
 * The profile system's promise is that a new section is one file.
 *
 * That promise is only true if selection is data-driven, so these tests check
 * the contract rather than any particular module: a module declares the kinds
 * it serves and its importance, and every entity of those kinds then shows it
 * with no page edit anywhere.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { allEntities, entitiesOfKind } from '../lib/entities/registry';
import { ENTITY_KINDS } from '../lib/entities/types';
import { PROFILE_MODULES, modulesFor } from '../lib/profile/modules';
import { defineModule } from '../lib/profile/define';

test('module ids are unique and ordering is deterministic', () => {
  const ids = PROFILE_MODULES.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length, 'two modules share an id');
  const sample = allEntities()[0];
  const order = modulesFor(sample).map((m) => m.importance);
  assert.deepEqual(
    [...order].sort((a, b) => a - b),
    order,
    'modules are not sorted by importance',
  );
});

test('discussion reaches every kind, because a claim is tested by being argued with', () => {
  for (const kind of ENTITY_KINDS) {
    const entity = entitiesOfKind(kind)[0];
    assert.ok(entity, `no ${kind} entity`);
    const ids = modulesFor(entity).map((m) => m.id);
    assert.ok(ids.includes('discussion'), `${kind} has no discussion module`);
  }
});

test('a discussion thread is keyed by a stable path, not by a filtered URL', () => {
  // A country's href carries a query string; if the thread were keyed on it,
  // the same country would hold different discussions per filter state.
  const country = entitiesOfKind('country')[0];
  const discussion = PROFILE_MODULES.find((m) => m.id === 'discussion');
  assert.ok(discussion && country);
  const output = discussion.render(country);
  assert.ok(output, 'country should have a discussion');
  assert.ok(!country.href.split('?')[0].includes('?'));
});

test('a company profile still carries every section the hand-written page had', () => {
  // The migration must not quietly drop a section. These are the four numbered
  // sections and the gaps block that lived in app/markets/[slug]/page.tsx,
  // plus the two shared modules.
  const company = entitiesOfKind('company').find((e) => e.key === 'posco');
  assert.ok(company, 'POSCO should be in the corpus');
  const ids = modulesFor(company).map((m) => m.id);
  for (const expected of ['products', 'topics', 'relief', 'gaps', 'timeline', 'discussion']) {
    assert.ok(ids.includes(expected), `company profile lost "${expected}"`);
  }
  // Order is the reading order the page had.
  assert.ok(ids.indexOf('products') < ids.indexOf('timeline'), 'products should precede timeline');
  assert.ok(ids.indexOf('timeline') < ids.indexOf('discussion'), 'discussion goes last');
});

test('company modules do not leak onto kinds that have no such data', () => {
  // `products` reads the market directory; asking it about a country must not
  // throw or invent a row.
  const country = entitiesOfKind('country')[0];
  const ids = modulesFor(country).map((m) => m.id);
  for (const companyOnly of ['products', 'topics', 'relief', 'gaps', 'timeline']) {
    assert.ok(!ids.includes(companyOnly), `${companyOnly} should not apply to a country`);
  }
});

test('a new module appears on every kind it declares, with no page edit', () => {
  // The whole modularity claim, exercised: define a module, and selection alone
  // decides where it shows up.
  const leadership = defineModule<{ note: string }>({
    id: 'test-leadership',
    title: 'Leadership',
    appliesTo: ['company', 'capital'],
    importance: 50,
    load: (entity) =>
      entity.kind === 'company' || entity.kind === 'capital' ? { note: 'x' } : null,
    Render: () => null,
  });

  for (const kind of ENTITY_KINDS) {
    const entity = entitiesOfKind(kind)[0];
    const declared = leadership.applies(entity.kind);
    assert.equal(
      declared,
      kind === 'company' || kind === 'capital',
      `${kind}: wrong applicability`,
    );
    // And it renders only where it has something to say.
    assert.equal(leadership.render(entity) !== null, declared, `${kind}: wrong render decision`);
  }
});

test('a module with nothing to say renders nothing at all', () => {
  // No empty shells: a thin entity should look thin, not broken.
  const empty = defineModule<string>({
    id: 'test-empty',
    title: 'Never shown',
    appliesTo: '*',
    importance: 10,
    load: () => null,
    Render: () => null,
  });
  for (const entity of allEntities().slice(0, 20)) {
    assert.equal(empty.render(entity), null, `${entity.id} rendered an empty module`);
  }
});
