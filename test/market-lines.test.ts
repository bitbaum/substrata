/**
 * The listings a company page reads prices for: the venues a fund file's
 * code can be read as, the name check that keeps another company's line off a
 * page, and the tracked set the daily run walks.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MARKET_SEED, tickerKey } from '../lib/market-data/identity';
import {
  isSeedLine,
  listingFromKey,
  trackedListings,
  venueExchange,
} from '../lib/market-data/company';
import { lineNameAgrees } from '../lib/market-data/prices/line-name';
import { hasAltSymbol, yahooSymbol } from '../lib/market-data/prices/yahoo';

test('a Bloomberg venue code reads as the exchange Yahoo serves it on', () => {
  assert.equal(venueExchange('BZ'), 'Sao Paulo');
  assert.equal(venueExchange('SS'), 'Stockholm');
  assert.equal(venueExchange('CV'), 'TSX Venture');
  assert.equal(venueExchange('XX'), null);
  assert.equal(venueExchange(undefined), null);
});

test('mainland China is two exchanges, told apart by the symbol and never guessed', () => {
  assert.equal(venueExchange('CH', '600519'), 'Shanghai');
  assert.equal(venueExchange('C2', '300750'), 'Shenzhen');
  assert.equal(venueExchange('CH', '000333'), 'Shenzhen');
  assert.equal(venueExchange('CH', 'ABC'), null);
  assert.equal(venueExchange('CH'), null);
});

test('a Canadian composite tries the TSX, then the TSX Venture', () => {
  const t = { exchange: 'Canada', symbol: 'AEC' } as const;
  assert.equal(yahooSymbol(t), 'AEC.TO');
  assert.equal(yahooSymbol(t, true), 'AEC.V');
  assert.ok(hasAltSymbol(t));
  assert.ok(!hasAltSymbol({ exchange: 'NASDAQ', symbol: 'NVDA' }));
});

test('a line is refused when the source names a different company', () => {
  assert.equal(lineNameAgrees('Samsung Sdi', ['SAMSUNG SDI CO LTD']), true);
  assert.equal(lineNameAgrees('Siemens Ag', ['Siemens Aktiengesellschaft']), true);
  assert.equal(lineNameAgrees('Alfen Beheer BV', ['Alfen N.V.']), true);
  assert.equal(lineNameAgrees('Aar Corp', ['Air Products and Chemicals']), false);
  assert.equal(lineNameAgrees('Anything', []), true, 'a source that names nothing cannot disagree');
});

test('a universe line is synthesised from its identifiers and keeps no market value claim', () => {
  const c = listingFromKey('alfen', 'Alfen', { ticker: 'ALFEN', exchange: 'NA' });
  assert.deepEqual(c?.ticker, { exchange: 'Euronext Amsterdam', symbol: 'ALFEN' });
  assert.notEqual(c?.marketCap, true);
  assert.equal(listingFromKey('x', 'X', { ticker: 'X', exchange: 'ZZ' }), null);
});

test('the daily run walks the seed first, then the universe, one line per ticker', () => {
  const lines = trackedListings();
  assert.ok(lines.length > MARKET_SEED.length, 'the universe adds lines beyond the seed');
  assert.equal(new Set(lines.map((c) => tickerKey(c.ticker))).size, lines.length);
  assert.ok(lines.slice(0, MARKET_SEED.length).every(isSeedLine));
  assert.ok(lines.slice(MARKET_SEED.length).every((c) => !isSeedLine(c)));
});
