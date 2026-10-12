import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createSearch, evaluate, typoCases } from '@bitbaum/searchkit';
import { COUNTRY_SEARCH } from '../components/portal/CountryFinder';
import { MAP_COUNTRIES } from '../app/atlas/countries';

/**
 * The atlas's country finder: the way to Malta or Liechtenstein on a phone.
 * One slip in a country's name — every neighbouring key, dropped, doubled
 * or swapped letter (`typoCases`) — still puts that country first.
 */
const finder = createSearch(MAP_COUNTRIES, COUNTRY_SEARCH);
const find = (q: string) => finder.search(q, { limit: 8 }).map((h) => h.item.iso);

test('one slip in a country name still finds it first', async () => {
  const cases = typoCases(MAP_COUNTRIES.map((c) => ({ id: c.iso, name: c.name })));
  const report = await evaluate(cases, find);
  const misses = report.misses.map((m) => `${m.query} → ${m.expect[0]}, got ${m.got.join(', ')}`);
  assert.ok(cases.length > 10_000, `${cases.length} cases`);
  assert.equal(report.zeroResults, 0);
  // The misses are slips that are another country's start or ISO code
  // ("mal" for Mali is also Malawi and Malaysia). Was 0.03 with substring
  // matching: 97% of these returned nothing.
  assert.ok(report.successAt1 >= 0.985, `success@1 ${report.successAt1}`);
  assert.ok(
    report.successAt3 >= 0.995,
    `success@3 ${report.successAt3}:\n  ${misses.join('\n  ')}`,
  );
});

test('a name by its start, an ISO code, and a slip', () => {
  const iso = (name: string) => MAP_COUNTRIES.find((c) => c.name === name)?.iso;
  assert.equal(find('liechtenstien')[0], iso('Liechtenstein'));
  assert.equal(find('sinagpore')[0], iso('Singapore'));
  assert.equal(find('mal')[0]?.startsWith('m'), true);
  assert.equal(find(iso('Japan')!)[0], iso('Japan'));
  assert.deepEqual(find('zzqx'), []);
});
