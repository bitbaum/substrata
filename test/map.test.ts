/**
 * The JSON map is the site for machines. It must agree with the site, and it
 * must not be able to say "sourced" about a row the coverage file does not.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildMap } from '../lib/map';
import { COVERAGE } from '../config/substrata-coverage';
import { coverageProgress } from '../lib/coverage-progress';
import { RESEARCH_PROGRAMMES } from '../config/substrata-programmes';
import { correctionUrl } from '../lib/site';

test('the map carries every producer row with a three-valued verification', () => {
  const map = buildMap();
  const rows = map.materials.flatMap((m) => m.producers);
  assert.equal(rows.length, coverageProgress().total);
  for (const row of rows) {
    assert.ok(['sourced', 'candidate', 'unverified'].includes(row.verification));
    if (row.verification === 'sourced')
      assert.ok(row.source, `${row.name} is sourced without a source`);
    if (row.source === null) assert.notEqual(row.verification, 'sourced');
  }
  assert.equal(
    map.progress.producers.sourced,
    rows.filter((r) => r.verification === 'sourced').length,
  );
  assert.equal(
    map.progress.producers.withCandidate,
    rows.filter((r) => r.verification === 'candidate').length,
  );
});

test('the map and the site are drawn from the same objects', () => {
  const map = buildMap();
  assert.deepEqual(
    map.materials.map((m) => m.material),
    COVERAGE.map((entry) => entry.material),
  );
  assert.equal(map.programmes.length, RESEARCH_PROGRAMMES.length);
  assert.equal(map.programmes[0].layers.length, RESEARCH_PROGRAMMES[0].layers.length);
  assert.ok(map.notice.includes('Only "sourced" is a finding'));
});

test('the correction link is a prefilled public issue', () => {
  const url = new URL(correctionUrl('The map'));
  assert.equal(url.origin + url.pathname, 'https://github.com/bitbaum/substrata/issues/new');
  assert.equal(url.searchParams.get('title'), 'Correction: The map');
  assert.ok(url.searchParams.get('body')?.includes('Source'));
});
