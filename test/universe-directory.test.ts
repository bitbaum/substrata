/** The directory: filters narrow, counts are honest, and typed words go through searchkit. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { directoryRows, queryDirectory, type DirectoryQuery } from '../lib/universe/directory';
import { pageKindCounts } from '../lib/universe/page-kinds';
import { universeEntries } from '../lib/universe/store';

const rows = directoryRows(universeEntries());
const none: DirectoryQuery = { q: '', tier: '', theme: '', country: '', kind: '' };

test('the directory holds exactly the admitted companies', () => {
  assert.equal(rows.length, universeEntries().filter((e) => e.admitted).length);
  assert.equal(queryDirectory(rows, none).matched, rows.length);
});

test('page kinds sum to the admitted count', () => {
  const k = pageKindCounts(universeEntries());
  assert.equal(k.filer + k.quote + k.identity, rows.length);
});

test('a theme and a country filter narrow, and every row matches both', () => {
  const r = queryDirectory(rows, { ...none, theme: 'nuclear', country: 'US' });
  assert.ok(r.matched > 0 && r.matched < rows.length);
  for (const row of r.rows) {
    assert.ok(row.themes.includes('nuclear'));
    assert.equal(row.country, 'US');
  }
});

test('a facet count says how many rows that option would give, its own selection lifted', () => {
  const r = queryDirectory(rows, { ...none, tier: 'A' });
  const all = queryDirectory(rows, none);
  assert.equal(r.counts.tier.B, all.counts.tier.B, 'tier B still counts while tier A is chosen');
  const b = queryDirectory(rows, { ...none, tier: 'B' });
  assert.equal(b.matched, all.counts.tier.B);
});

test('typed words find a name, a ticker and a slip, through searchkit', () => {
  assert.ok(queryDirectory(rows, { ...none, q: 'nvidia' }).rows.some((r) => r.slug === 'nvidia'));
  assert.ok(queryDirectory(rows, { ...none, q: 'AMD' }).rows.some((r) => r.slug === 'amd'));
  assert.ok(queryDirectory(rows, { ...none, q: 'nvidai' }).rows.some((r) => r.slug === 'nvidia'));
  assert.equal(queryDirectory(rows, { ...none, q: 'zzzzqqqq' }).matched, 0);
});
