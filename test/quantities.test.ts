/**
 * Numbers are claims, so they get the same discipline as the prose.
 *
 * A figure without a year is a lie with a decimal point, an estimate rendered
 * as a measurement is the failure this project exists to avoid, and a derived
 * number that cannot be traced to its inputs is an assertion wearing arithmetic.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ENDOWMENTS, WORLD_TOTALS, UNIT_LABEL } from '../config/substrata-quantities';
import { SUBSTITUTES, blockedByPhysics, substitutesFor } from '../config/substrata-substitutes';
import { concentrationOf, reservesToProduction, sharesFor } from '../lib/quantities';
import { entitiesOfKind, resolveIn } from '../lib/entities/registry';

test('every figure carries a year, a basis and a source', () => {
  for (const row of [...ENDOWMENTS]) {
    for (const [what, quantity] of [
      ['production', row.production],
      ['reserves', row.reserves],
    ] as const) {
      if (!quantity) continue;
      assert.ok(
        quantity.year >= 2000 && quantity.year <= 2030,
        `${row.material}/${row.place} ${what}: bad year`,
      );
      assert.ok(
        ['reported', 'estimated', 'withheld'].includes(quantity.basis),
        `${row.material}/${row.place} ${what}: no basis`,
      );
      assert.ok(quantity.value >= 0, `${row.material}/${row.place} ${what}: negative`);
      assert.ok(UNIT_LABEL[quantity.unit], `${row.material}/${row.place} ${what}: unknown unit`);
    }
    assert.match(row.source, /^https?:\/\//, `${row.material}/${row.place}: source is not a URL`);
    assert.match(row.readOn, /^\d{4}-\d{2}-\d{2}$/, `${row.material}/${row.place}: no read date`);
  }
});

test('every figure hangs off a real bottleneck and a real country', () => {
  const materials = new Set(entitiesOfKind('bottleneck').map((e) => e.key));
  for (const row of [...ENDOWMENTS, ...WORLD_TOTALS.map((t) => ({ ...t, place: 'us' }))]) {
    assert.ok(materials.has(row.material), `no bottleneck "${row.material}"`);
  }
  for (const row of ENDOWMENTS) {
    assert.ok(resolveIn('country', row.place), `no country "${row.place}"`);
  }
});

test('shares are computed against the published total, in the same unit', () => {
  // Dividing kilograms by cubic metres would produce a number, and it would be
  // meaningless. The unit check is the reason `share` is optional.
  for (const total of WORLD_TOTALS) {
    for (const row of sharesFor(total.material)) {
      if (row.share === undefined) continue;
      assert.equal(row.production.unit, total.total.unit, `${total.material}: unit mismatch`);
      assert.ok(
        row.share > 0 && row.share <= 1,
        `${total.material}/${row.place}: share out of range`,
      );
    }
  }
});

test('no country is recorded as producing more than the world', () => {
  for (const total of WORLD_TOTALS) {
    for (const row of sharesFor(total.material)) {
      if (row.production.unit !== total.total.unit) continue;
      assert.ok(
        row.production.value <= total.total.value,
        `${total.material}/${row.place} exceeds the world total`,
      );
    }
  }
});

test('concentration is arithmetic from the shares, not an opinion', () => {
  const gallium = concentrationOf('gallium-refined');
  assert.ok(gallium, 'gallium should have a concentration');
  // China is ~99% of primary gallium, so the index must be near 1.
  assert.ok(gallium.hhi > 0.9, `expected near-monopoly, got ${gallium.hhi}`);
  const helium = concentrationOf('liquid-helium-he-4');
  assert.ok(helium && helium.hhi < gallium.hhi, 'helium is less concentrated than gallium');
  // And it is bounded, because it is a sum of squared fractions.
  for (const index of [gallium.hhi, helium.hhi]) assert.ok(index > 0 && index <= 1);
  assert.equal(concentrationOf('not-a-material'), undefined);
});

test('reserves-to-production refuses to divide unlike units or by zero', () => {
  const us = reservesToProduction('liquid-helium-he-4', 'us');
  assert.ok(us && us.years > 0, 'US helium should have an R/P');
  assert.equal(us.reserves.unit, us.production.unit);
  // Gallium has no reserves figure at all — USGS does not publish one, and the
  // absence must not be read as zero.
  assert.equal(reservesToProduction('gallium-refined', 'cn'), undefined);
});

test('a substitute says what blocks it, and physics is distinguished from a schedule', () => {
  for (const row of SUBSTITUTES) {
    assert.ok(row.blockedBy.length > 0, `${row.candidate}: nothing blocks it?`);
    assert.ok(row.why.length > 80, `${row.candidate}: the nuance is the point`);
    assert.ok(row.sources.length > 0, `${row.candidate}: unsourced`);
    for (const source of row.sources) assert.match(source, /^https?:\/\//);
  }
  // Helium below 4 K is the one case where the answer is a law.
  assert.equal(blockedByPhysics('liquid-helium-he-4'), true);
  // Gallium is a schedule and a price, not a law — the distinction the score hid.
  assert.equal(blockedByPhysics('gallium-refined'), false);
  assert.ok(substitutesFor('gallium-refined').every((row) => !row.blockedBy.includes('physics')));
});
