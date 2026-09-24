/**
 * Pinned home lines: where OpenFIGI truncates a name past what the strict
 * matcher can read, a person pins ticker + exchange + the exact name, and
 * the generator takes the line only while all three still hold.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LISTING_OVERRIDES } from '../config/substrata-listing-overrides';
import { LISTINGS } from '../lib/listings';
import { isPinned, pinnedLine, sameCompany } from '../lib/listing-match';
import { resolveHolding } from '../lib/xray/resolve';

const TSMC_PIN = {
  ticker: '2330',
  exchange: 'TT',
  figiName: 'TAIWAN SEMICONDUCTOR MANUFAC',
  checkedOn: '2026-09-25',
};

test('the strict matcher still cannot read a truncated name — that is why pins exist', () => {
  assert.equal(
    sameCompany('TAIWAN SEMICONDUCTOR MANUFACTURING', 'TAIWAN SEMICONDUCTOR MANUFAC'),
    false,
  );
  assert.equal(sameCompany('NKT', 'NKT A/S'), false);
});

test('a pin takes only the exact ticker and name it names', () => {
  const row = {
    ticker: '2330',
    name: 'TAIWAN SEMICONDUCTOR MANUFAC',
    figi: 'BBG000BN2JD8',
    compositeFIGI: 'BBG000BN2HR7',
  };
  const line = pinnedLine([row], TSMC_PIN);
  assert.deepEqual(line, {
    ticker: '2330',
    exchange: 'TT',
    name: 'TAIWAN SEMICONDUCTOR MANUFAC',
    figi: 'BBG000BN2HR7',
    source: 'https://www.openfigi.com/id/BBG000BN2HR7',
  });
  assert.equal(pinnedLine([{ ...row, name: 'TAIWAN SEMICONDUCTOR MFG' }], TSMC_PIN), null);
  assert.equal(pinnedLine([{ ...row, ticker: '2303' }], TSMC_PIN), null);
  assert.equal(pinnedLine([], TSMC_PIN), null);
});

test('every pinned company carries its pinned line as the primary listing', () => {
  const pinned = Object.entries(LISTING_OVERRIDES).flatMap(([slug, o]) =>
    'home' in o && o.home ? [[slug, o.home] as const] : [],
  );
  assert.ok(pinned.length >= 5);
  for (const [slug, pin] of pinned) {
    const listing = LISTINGS.listings[slug];
    assert.ok(listing && 'primary' in listing, `${slug}: no listing`);
    assert.ok(
      isPinned(listing.primary, pin),
      `${slug}: primary is not ${pin.ticker} ${pin.exchange}`,
    );
    assert.match(listing.primary!.source, /^https:\/\/www\.openfigi\.com\/id\/BBG/);
  }
});

test('2330 TT is TSMC, RIO LN is Rio Tinto, and the US lines still resolve', () => {
  const tt = resolveHolding({ ticker: '2330', exchange: 'TT' });
  assert.deepEqual(tt.status === 'resolved' && tt.slugs, ['tsmc', 'tsmc-advanced-packaging']);
  const tsm = resolveHolding({ ticker: 'TSM', exchange: null });
  assert.deepEqual(tsm.status === 'resolved' && tsm.slugs, ['tsmc', 'tsmc-advanced-packaging']);
  const rio = resolveHolding({ ticker: 'RIO', exchange: 'LN' });
  assert.deepEqual(rio.status === 'resolved' && rio.slugs, ['rio-tinto']);
});
