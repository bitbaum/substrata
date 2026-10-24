/**
 * Entity resolution in the relation graph: only reviewed pairs merge
 * (config/entity-aliases.ts), the matcher only proposes (lib/graph/alias-match.ts),
 * and a typed name finds its node (lib/graph/find.ts).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import producers from '../research/usgs-producers.json';
import { ENTITY_ALIASES } from '../config/entity-aliases';
import { aliasCandidates, aliasRule, matchKey, type MatchNode } from '../lib/graph/alias-match';
import { aliasProblems, canonicalId } from '../lib/graph/aliases';
import { findGraphNode } from '../lib/graph/find';
import { allRelations, relationsFrom } from '../lib/graph/index';

const node = (id: string, name: string, iso2: string[] = ['kz'], neighbours: string[] = []) =>
  ({ id, name, iso2, neighbours }) as MatchNode;

test('the alias table is reviewed: a reason from the data, a source, no chains', () => {
  assert.deepEqual(aliasProblems(), []);
  assert.ok(
    aliasProblems([
      { ...ENTITY_ALIASES[0], canonical: ENTITY_ALIASES[1].alias },
      ENTITY_ALIASES[1],
    ]).some((p) => /chain/.test(p)),
  );
  assert.ok(aliasProblems([{ ...ENTITY_ALIASES[0], reason: 'same' }]).length > 0);
});

test('each reviewed pair is printed by the very rows its reason names', () => {
  const cells = (producers as { countries: { facilities: { companies: string }[] }[] }).countries
    .flatMap((c) => c.facilities.map((f) => f.companies))
    .join('\n');
  for (const a of ENTITY_ALIASES) {
    assert.ok(cells.includes(`${a.printed},`), `the yearbook prints "${a.printed}"`);
    assert.ok(cells.includes(a.name), `the yearbook prints "${a.name}"`);
  }
});

test('a merged alias has no edge of its own; its edges moved to the canonical id', () => {
  const ends = new Set(allRelations().flatMap((r) => [r.from, r.to]));
  for (const a of ENTITY_ALIASES) {
    assert.ok(!ends.has(a.alias), `${a.alias} is gone`);
    assert.equal(canonicalId(a.alias), a.canonical);
  }
  // PE Ortalyk was printed under "NAC Kazatomp JSC"; it is Kazatomprom's now.
  const held = relationsFrom('company:nac-kazatomprom-jsc', { type: 'owns' }).map((r) => r.to);
  assert.ok(held.includes('company:pe-ortalyk-llp'));
  assert.equal(held.length, 16);
});

test('the matcher proposes by named rules, and never a subsidiary for its parent', () => {
  assert.equal(matchKey('NAC Kazatomprom JSC'), 'nac kazatomprom');
  assert.equal(
    aliasRule(node('a', 'NAC Kazatomp JSC'), node('b', 'NAC Kazatomprom JSC')),
    'cut-short',
  );
  // Cut short only within one country's tables.
  assert.equal(
    aliasRule(node('a', 'NAC Kazatomp JSC', ['cl']), node('b', 'NAC Kazatomprom JSC')),
    null,
  );
  assert.equal(aliasRule(node('a', 'UraniumOne Inc.'), node('b', 'Uranium One Inc.')), 'spacing');
  assert.equal(aliasRule(node('a', 'Glencore'), node('b', 'Glencore Plc.')), 'legal-form');
  assert.equal(
    aliasRule(node('a', 'GMK Norilskiy Nikel'), node('b', 'GMK Norilsky Nikel')),
    'transliteration',
  );
  assert.equal(aliasRule(node('a', 'Glencore International AG'), node('b', 'Glencore Plc.')), null);
  assert.equal(
    aliasRule(node('a', 'Uranium One Rotterdam B.V.'), node('b', 'Uranium One Inc.')),
    null,
  );
  const found = aliasCandidates(
    [
      node('company:x', 'Akbastau JV', ['kz'], ['n']),
      node('company:y', 'JV Akbastau JSC', ['kz'], ['n']),
      node('company:z', 'Glencore', ['au']),
      node('company:w', 'Glencore Plc.', ['au']),
    ],
    new Set(['company:z|company:w']),
  );
  assert.deepEqual(
    found.map((c) => [c.a.id, c.b.id, c.rule, c.shared]),
    [['company:x', 'company:y', 'legal-form', ['n']]],
    'a reviewed pair is not proposed again; the evidence travels with the proposal',
  );
});

test('a typed name finds its graph node, and says what else it fit', () => {
  assert.equal(findGraphNode('Inkai')?.node.id, 'company:jv-inkai-llp');
  assert.equal(findGraphNode('Sumitomo')?.node.id, 'company:sumitomo-corp');
  assert.equal(findGraphNode('Cameco')?.node.id, 'company:cameco-corp');
  const kaz = findGraphNode('Kazatomprom', { prefer: 'owner' });
  assert.equal(kaz?.node.id, 'company:nac-kazatomprom-jsc');
  assert.ok(kaz?.alsoMatched.some((n) => n.name === 'Kazatomprom-SaUran LLP'));
  // "Who owns Collahuasi": the venture with owners, not the holding company.
  assert.equal(
    findGraphNode('Collahuasi', { prefer: 'owned' })?.node.id,
    'company:compania-minera-dona-ines-de-collahuasi-scm',
  );
  assert.equal(findGraphNode('Gazprom')?.how, 'directory');
  assert.equal(findGraphNode('Zzyzx Holdings'), null);
});
