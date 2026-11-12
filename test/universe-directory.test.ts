/** The directory: filters narrow through listkit, counts are honest, and typed words go through searchkit. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DIRECTORY_MAX,
  DIRECTORY_PAGE,
  directoryRows,
  directorySpec,
  parseDirectory,
  queryDirectory,
} from '../lib/universe/directory';
import { moreHref, rowsShown, shownQuery } from '../lib/list-more';
import { pageKindCounts } from '../lib/universe/page-kinds';
import { universeEntries } from '../lib/universe/store';

const rows = directoryRows(universeEntries());
const spec = directorySpec(rows);
type Params = Record<string, string | undefined>;
/** Every matching row drawn, so `rows` can be checked whole. */
const run = (params: Params) =>
  queryDirectory(rows, spec, shownQuery(parseDirectory(params, spec), DIRECTORY_MAX));

test('the directory holds exactly the admitted companies', () => {
  assert.equal(rows.length, universeEntries().filter((e) => e.admitted).length);
  assert.equal(run({}).matched, rows.length);
});

test('page kinds sum to the admitted count', () => {
  const k = pageKindCounts(universeEntries());
  assert.equal(k.filer + k.quote + k.identity, rows.length);
});

test('a theme and a country filter narrow, and every row matches both', () => {
  const r = run({ theme: 'nuclear', country: 'US' });
  assert.ok(r.matched > 0 && r.matched < rows.length);
  for (const row of r.rows) {
    assert.ok(row.themes.includes('nuclear'));
    assert.equal(row.country, 'US');
  }
});

test('a facet count says how many rows that option would give, its own selection lifted', () => {
  const r = run({ tier: 'A' });
  const all = run({});
  assert.equal(r.counts.tier.B, all.counts.tier.B, 'tier B still counts while tier A is chosen');
  const b = run({ tier: 'B' });
  assert.equal(b.matched, all.counts.tier.B);
});

test('typed words find a name, a ticker and a slip, through searchkit', () => {
  assert.ok(run({ q: 'nvidia' }).rows.some((r) => r.slug === 'nvidia'));
  assert.ok(run({ q: 'AMD' }).rows.some((r) => r.slug === 'amd'));
  assert.ok(run({ q: 'nvidai' }).rows.some((r) => r.slug === 'nvidia'));
  assert.equal(run({ q: 'zzzzqqqq' }).matched, 0);
});

test('a value no option carries filters nothing, as before', () => {
  assert.equal(run({ tier: 'C' }).matched, rows.length);
  assert.equal(run({ theme: 'not-a-theme' }).matched, rows.length);
});

test('a comma in the typed words is part of the search, not a list', () => {
  assert.equal(parseDirectory({ q: ' AMD, uranium ' }, spec).q, 'AMD, uranium');
});

test('"Show more" draws one more batch and keeps the filters, through ?n=', () => {
  const params = { theme: 'nuclear', n: '60', country: '' };
  const shown = rowsShown(params, DIRECTORY_PAGE, DIRECTORY_MAX);
  const query = shownQuery(parseDirectory(params, spec), shown);
  assert.equal(queryDirectory(rows, spec, query).rows.length <= 60, true);
  const href = moreHref('/markets/directory', params, query, spec, DIRECTORY_PAGE);
  const next = new URL(href, 'https://x').searchParams;
  assert.equal(next.get('theme'), 'nuclear');
  assert.equal(next.get('n'), '120');
  assert.equal(next.has('country'), false, 'an empty filter is not written back');
  assert.equal(rowsShown({ n: '5' }, DIRECTORY_PAGE, DIRECTORY_MAX), DIRECTORY_PAGE);
  assert.equal(rowsShown({ n: '99999' }, DIRECTORY_PAGE, DIRECTORY_MAX), DIRECTORY_MAX);
});
