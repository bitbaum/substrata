/**
 * "Ways to take part" on a company profile: work there, own part of it, buy
 * from it. These hold that every route rests on a row the page has, that a
 * missing row is said rather than invented, and that the not-advice line is
 * never dropped from the copy.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TAKE_PART_NOT_ADVICE } from '../config/substrata-take-part';
import { LISTINGS, terminalTicker } from '../lib/listings';
import { MARKET_PARTICIPANTS } from '../lib/participants';
import { takePartRoutes, type TakePartInput } from '../lib/take-part';

const base: TakePartInput = {
  slug: 'acme',
  name: 'Acme',
  role: 'Widget making',
  listing: null,
  ownPage: null,
  hiring: null,
  hasFilings: false,
};

test('every profile gets work, own and buy, in that order', () => {
  for (const p of MARKET_PARTICIPANTS) {
    const routes = takePartRoutes({
      ...base,
      slug: p.slug,
      name: p.name,
      role: p.role,
      listing: LISTINGS.listings[p.slug] ?? null,
      ownPage: p.directorySource,
    });
    assert.deepEqual(
      routes.map((r) => r.kind),
      ['work', 'own', 'buy'],
      p.slug,
    );
    for (const r of routes) assert.ok(r.text.trim().length > 0, `${p.slug} ${r.kind}`);
  }
});

test('a listed company names its tickers and links each to its source', () => {
  const [slug, listing] = Object.entries(LISTINGS.listings).find(
    ([, l]) => l.status === 'listed' && l.primary,
  )!;
  assert.equal(listing.status, 'listed');
  const own = takePartRoutes({ ...base, slug, listing, hasFilings: true })[1];
  const ticker = terminalTicker(listing.primary!);
  assert.match(own.text, new RegExp(ticker));
  assert.ok(own.links.some((l) => l.href === listing.primary!.source && l.external));
  assert.ok(own.links.some((l) => l.href === '#filings'));
});

test('a subsidiary says it is reached only through its parent', () => {
  const [slug, listing] = Object.entries(LISTINGS.listings).find(([, l]) => l.status === 'parent')!;
  assert.equal(listing.status, 'parent');
  const own = takePartRoutes({ ...base, slug, listing })[1];
  assert.match(own.text, new RegExp(`part of ${listing.parent}`));
});

test('private or unfound companies offer no share link', () => {
  for (const status of ['private', 'none-found'] as const) {
    const listing =
      status === 'private'
        ? ({ status, note: 'Family-owned.', checkedOn: '2026-10-01' } as const)
        : ({ status, query: 'Acme', checkedOn: '2026-10-01' } as const);
    const own = takePartRoutes({ ...base, listing })[1];
    assert.equal(own.links.length, 0, status);
    assert.match(own.text, /not traded|No public listing/);
  }
});

test('hiring links to the live roles and the official page, or says neither is known', () => {
  const live = takePartRoutes({
    ...base,
    hiring: { careersUrl: 'https://acme.example/jobs', live: true, total: 12 },
  })[0];
  assert.deepEqual(
    live.links.map((l) => l.href),
    ['/careers?company=acme', 'https://acme.example/jobs'],
  );
  assert.match(live.links[0].label, /12 open roles/);
  const none = takePartRoutes(base)[0];
  assert.match(none.text, /No careers page is recorded/);
});

test('buy links the company’s own page only when there is one', () => {
  assert.equal(takePartRoutes(base)[2].links.length, 0);
  const withPage = takePartRoutes({ ...base, ownPage: 'https://acme.example' })[2];
  assert.deepEqual(withPage.links, [
    { label: 'Its own page', href: 'https://acme.example', external: true },
  ]);
});

test('the not-advice line leads the section copy', () => {
  assert.equal(TAKE_PART_NOT_ADVICE.lead, 'Not investment advice.');
  assert.match(TAKE_PART_NOT_ADVICE.body, /not whether anyone should/);
});
