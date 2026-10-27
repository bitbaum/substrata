/** "What we do not know yet": each gap is said once, with its sources and a task. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mergeUnknowns, readUnknowns, staticUnknowns } from '../lib/company-page/unknowns';
import { universeEntry } from '../lib/universe/store';

const base = { slug: 'acme', name: 'Acme', relations: 3 };

test('an unlisted company says why there is no quote and queues a task', () => {
  const u = staticUnknowns({ ...base, listed: false, noListing: 'It is private.' });
  const listing = u.find((x) => x.box === 'listing')!;
  assert.match(listing.missing, /private/);
  assert.equal(listing.task.id, 'company:acme#listing');
  assert.equal(listing.task.entity, 'company:acme');
  assert.ok(listing.task.allowedSources.length > 0);
});

test('a listed company with no SEC id names the filings it lacks and estimates nothing', () => {
  const entry = { ids: { ticker: 'X' } } as never;
  const u = staticUnknowns({ ...base, entry, listed: true });
  const f = u.find((x) => x.box === 'financials')!;
  assert.match(f.missing, /No figure is estimated/);
  assert.ok(f.sources.some((s) => /annual report/.test(s)));
  assert.ok(
    u.some((x) => x.box === 'identity'),
    'no LEI is a gap',
  );
});

test('no relation names it: customers, suppliers and competitors are a gap', () => {
  const u = staticUnknowns({
    ...base,
    listed: true,
    relations: 0,
    entry: { ids: { cik: '1', lei: 'L' }, country: 'US' } as never,
  });
  assert.deepEqual(
    u.map((x) => x.box),
    ['relations'],
  );
});

test('a read that found a hole replaces the static gap for the same box', () => {
  const merged = mergeUnknowns(
    staticUnknowns({ ...base, listed: true, entry: { ids: { ticker: 'X' } } as never }),
    readUnknowns('acme', { price: null, financials: 'The SEC answered 404.', holders: null }),
  );
  assert.equal(merged.filter((x) => x.box === 'financials').length, 1);
  assert.equal(merged.find((x) => x.box === 'financials')!.missing, 'The SEC answered 404.');
});

test('every gap is a task with the box in its id, for a real admitted company', () => {
  const nvidia = universeEntry('nvidia')!;
  const u = staticUnknowns({ ...base, slug: 'nvidia', entry: nvidia, listed: true, relations: 1 });
  for (const x of u) assert.equal(x.task.id, `company:nvidia#${x.box}`);
});
