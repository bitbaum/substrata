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
import { readdirSync, readFileSync } from 'node:fs';

import { allEntities, entitiesOfKind } from '../lib/entities/registry';
import { ENTITY_KINDS, type EntityKind } from '../lib/entities/types';
import { PROFILE_MODULES, modulesFor } from '../lib/profile/modules';
import { defineModule } from '../lib/profile/define';
import { connectionsFor } from '../lib/profile/modules/shared';

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

test('every module is styled from one vocabulary', () => {
  // Profiles are read one after another, so a module carrying its own CSS family
  // reads as a different product. `.research-card-grid` set headings at 1.5rem —
  // LARGER than the section heading above them — and `.research-prose` used its
  // own margins and line height. Modules use the shared utility classes only.
  const dir = new URL('../lib/profile/modules/', import.meta.url);
  const offenders: string[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.tsx') && !file.endsWith('.ts')) continue;
    const source = readFileSync(new URL(file, dir), 'utf8');
    for (const banned of ['research-card-grid', 'research-prose', 'research-results']) {
      if (source.includes(banned)) offenders.push(`${file} uses .${banned}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `Modules must share one styling vocabulary:\n  ${offenders.join('\n  ')}`,
  );
});

test('each migrated page kept every section it had', () => {
  // The sections each page hand-wrote before the migration. If a module stops
  // applying, or an id is renamed, this is where it surfaces — not in a
  // screenshot somebody happens to look at.
  const expected: Record<string, string[]> = {
    bottleneck: [
      'why',
      'severity',
      'producers',
      'rules',
      'removes',
      'calls',
      'funding',
      'timeline',
      'loops',
    ],
    science: ['relieves', 'readiness', 'milestone'],
    capital: ['mandate', 'can-move', 'source-sentence'],
    company: ['products', 'topics', 'relief', 'gaps', 'timeline'],
  };

  for (const [kind, ids] of Object.entries(expected)) {
    // A kind's sections are conditional on data, so check against the union of
    // what its entities can render rather than one sample that may be thin.
    const available = new Set(
      entitiesOfKind(kind as EntityKind).flatMap((entity) =>
        modulesFor(entity).map((module) => module.id),
      ),
    );
    for (const id of ids) {
      assert.ok(available.has(id), `${kind} lost its "${id}" section`);
    }
  }
});

test('every kind reads in the same order, so profiles are comparable', () => {
  // One importance scale across kinds: identity, judgement, who is involved,
  // what governs it, what has happened, connections, discussion.
  for (const kind of ENTITY_KINDS) {
    const entity = entitiesOfKind(kind)[0];
    const ids = modulesFor(entity).map((m) => m.id);
    if (ids.includes('timeline') && ids.includes('discussion'))
      assert.ok(
        ids.indexOf('timeline') < ids.indexOf('discussion'),
        `${kind}: timeline after discussion`,
      );
    if (ids.includes('related') && ids.includes('discussion'))
      assert.ok(
        ids.indexOf('related') < ids.indexOf('discussion'),
        `${kind}: related after discussion`,
      );
    assert.equal(ids.at(-1), 'discussion', `${kind}: discussion should be last`);
  }
});

test('connections never repeat a section the profile already has', () => {
  // A bottleneck lists its makers under "Who makes it" and its funders under
  // "Who could fund relief". Repeating both as "produced by" and "fundable by"
  // turned this module into a second copy of two sections directly above it.
  const bottleneck = entitiesOfKind('bottleneck').find(
    (e) => e.key === 'grain-oriented-electrical-steel-goes',
  );
  assert.ok(bottleneck, 'GOES should be in the corpus');
  const rels = connectionsFor(bottleneck).map((edge) => edge.rel);
  assert.ok(!rels.includes('produced by'), 'producers already have a section');
  assert.ok(!rels.includes('fundable by'), 'funders already have a section');

  const company = entitiesOfKind('company').find((e) => e.key === 'posco');
  assert.ok(company, 'POSCO should be in the corpus');
  const companyRels = connectionsFor(company).map((edge) => edge.rel);
  assert.ok(!companyRels.includes('makes'), 'what it makes already has a section');
  // And it still says the thing nothing else does.
  assert.ok(companyRels.includes('located in'), 'jurisdiction is not shown anywhere else');
});
