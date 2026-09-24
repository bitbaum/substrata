/**
 * Listings, the exposure screen and SEC filings: every ticker traceable to
 * its source, every row to the corpus, every filing to EDGAR.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LISTING_OVERRIDES } from '../config/substrata-listing-overrides';
import { MARKET_PARTICIPANTS } from '../lib/participants';
import { BOTTLENECKS } from '../lib/bottlenecks';
import { LISTINGS, edgarRegistrants, terminalTicker } from '../lib/listings';
import { CSV_HEADER, csvCells, exposureRows, netPressure, toCsv } from '../lib/exposure';
import { parseExposureQuery, selectRows } from '../lib/exposure-query';
import { filingHeadline, parseSubmissions } from '../lib/filings';

const SLUGS = new Set(MARKET_PARTICIPANTS.map((p) => p.slug));

test('every listing override names a company in the directory', () => {
  const unknown = Object.keys(LISTING_OVERRIDES).filter((slug) => !SLUGS.has(slug));
  assert.deepEqual(unknown, [], 'an override for a slug that does not exist is dead config');
});

test('every listing is for a known company and carries its source', () => {
  for (const [slug, listing] of Object.entries(LISTINGS.listings)) {
    assert.ok(SLUGS.has(slug), `${slug}: not in the directory`);
    if (listing.status === 'listed' || listing.status === 'parent') {
      const refs = [listing.primary, listing.us].filter(Boolean);
      assert.ok(refs.length > 0, `${slug}: listed with no security`);
      for (const ref of refs)
        assert.match(ref!.source, /^https:\/\/(www\.openfigi\.com|www\.sec\.gov)\//);
    }
    if (listing.status === 'parent') {
      const override = LISTING_OVERRIDES[slug];
      assert.ok(
        override && 'parent' in override,
        `${slug}: a parent listing must come from an override`,
      );
    }
    if (listing.status === 'private') {
      const override = LISTING_OVERRIDES[slug];
      assert.ok(override && 'private' in override, `${slug}: "private" must come from an override`);
    }
  }
});

test('a US listing without a FIGI reads as a US ticker', () => {
  assert.equal(
    terminalTicker({ ticker: 'WOLF', exchange: 'NYSE', name: 'WOLFSPEED', source: 'x' }),
    'WOLF US',
  );
  assert.equal(
    terminalTicker({
      ticker: '8035',
      exchange: 'JP',
      name: 'TOKYO ELECTRON',
      figi: 'BBG000BB59S7',
      source: 'x',
    }),
    '8035 JP',
  );
  const ciks = edgarRegistrants().map((r) => r.cik);
  assert.equal(
    new Set(ciks).size,
    ciks.length,
    'one EDGAR fetch per registrant, however many slugs share it',
  );
});

test('every holder of every bottleneck is a row, and pressure counts only reviewed events', () => {
  const rows = exposureRows(new Date('2026-09-24T00:00:00Z'));
  const holders = BOTTLENECKS.reduce((n, b) => n + b.producers.length, 0);
  assert.equal(rows.length, holders);
  for (const b of BOTTLENECKS) {
    const expected = b.events
      .filter((e) => e.date >= '2026-06-26')
      .reduce((n, e) => n + (e.effect === 'tightens' ? 1 : e.effect === 'loosens' ? -1 : 0), 0);
    assert.equal(netPressure(b, new Date('2026-09-24T00:00:00Z')), expected, b.name);
  }
});

test('the CSV has one cell per header and quotes what needs quoting', () => {
  const rows = exposureRows();
  for (const row of rows) assert.equal(csvCells(row).length, CSV_HEADER.length);
  const csv = toCsv(rows.slice(0, 3));
  assert.equal(csv.split('\n')[0], CSV_HEADER.join(','));
  assert.ok(toCsv([{ ...rows[0], company: 'A, "B"' }]).includes('"A, ""B"""'));
});

test('"only recorded maker" keeps sole makers and never a part supplier', () => {
  const sole = selectRows(exposureRows(), parseExposureQuery({ sole: '1' }), null);
  assert.ok(sole.length > 0);
  assert.ok(sole.every((r) => !r.supplier && r.otherMakers === 0));
  assert.ok(
    sole.some((r) => r.company === 'ASML'),
    'ASML is the only recorded EUV scanner maker',
  );
});

test('EDGAR submissions: kept forms only, within the window, with a working link', () => {
  const filings = parseSubmissions(
    {
      cik: '937966',
      name: 'ASML HOLDING NV',
      filings: {
        recent: {
          accessionNumber: ['0000937966-26-000101', '0000937966-26-000090', '0000937966-25-000010'],
          filingDate: ['2026-09-20', '2026-09-10', '2025-01-10'],
          acceptanceDateTime: ['2026-09-20T12:01:02.000Z', '2026-09-10T08:00:00.000Z', ''],
          form: ['6-K', '4', '6-K'],
          items: ['', '', ''],
          primaryDocument: ['q3.htm', 'f4.xml', 'old.htm'],
          primaryDocDescription: ['6-K', 'FORM 4', '6-K'],
        },
      },
    },
    '2026-06-01',
  );
  assert.equal(filings.length, 1, 'a Form 4 and a filing older than the window are both dropped');
  assert.equal(
    filings[0].url,
    'https://www.sec.gov/Archives/edgar/data/937966/000093796626000101/q3.htm',
  );
  assert.equal(filings[0].acceptedAt, '2026-09-20T12:01:02.000Z');
});

test('an 8-K headline names its items in words and skips the exhibits item', () => {
  assert.equal(
    filingHeadline({ form: '8-K', items: ['2.02', '9.01'], description: '' }, 'Wolfspeed'),
    'Wolfspeed — Results of operations',
  );
  assert.equal(
    filingHeadline({ form: '6-K', items: [], description: '' }, 'ASML'),
    'ASML — Foreign issuer report',
  );
});

import { choosePrimary, sameCompany } from '../lib/listing-match';

test('a listing must be the same company, not one that shares a word', () => {
  // Each of these was attached by the first, looser rule.
  assert.equal(sameCompany('The Quartz Corp', 'QUARTZ MOUNTAIN RESOURCES LTD'), false);
  assert.equal(sameCompany('SK INC', 'SK TELECOM CO LTD'), false);
  assert.equal(sameCompany('China Rare Earth Group', 'CHINA NORTHERN RARE EARTH -A'), false);
  // And these are the same company under a fuller or noisier name.
  assert.equal(sameCompany('Air Products', 'Air Products & Chemicals, Inc.'), true);
  assert.equal(sameCompany('Impala Platinum', 'IMPALA PLATINUM HOLDINGS LTD'), true);
  assert.equal(sameCompany('Minsur', 'MINSUR SA-INVERSIONES'), true);
  assert.equal(sameCompany('China Northern Rare Earth', 'CHINA NORTHERN RARE EARTH -A'), true);
  assert.equal(sameCompany('ASML', 'ASML HOLDING NV'), true);
});

test('the primary line is where the company trades, not an order-book copy', () => {
  const ref = (ticker: string, exchange: string) => ({ ticker, exchange, name: 'X', source: 'x' });
  assert.equal(
    choosePrimary([ref('0M2B', 'LN')], ref('LIN', 'Nasdaq'), ['GB', 'US', 'DE'])?.ticker,
    'LIN',
  );
  assert.equal(choosePrimary([ref('0M2B', 'LN')], null, ['GB'])?.ticker, undefined);
  assert.equal(choosePrimary([ref('8035', 'JP')], ref('TOELY', 'OTC'), ['JP'])?.ticker, '8035');
  assert.equal(
    choosePrimary([], ref('HTHIY', 'OTC'), ['JP']),
    null,
    'an OTC ADR is never the primary',
  );
});
