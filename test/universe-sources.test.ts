/**
 * The universe's source adapters on recorded responses (test/fixtures/sources,
 * manifest.json): each fund format, EDGAR's tickers, floats and SIC listing,
 * GLEIF and Wikidata by ISIN. Real bytes, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FUNDS } from '../config/universe-sources';
import { fundRows, isinOfCusip, readFund } from '../lib/sources/etf-holdings';
import { csvCells, splitTicker } from '../lib/sources/etf-parse';
import {
  floatRow,
  readFloats,
  readSicFilers,
  readTickers,
  sicRow,
} from '../lib/sources/edgar-universe';
import { leiForIsin, qidsForIsins } from '../lib/sources/registry-ids';
import { offline } from './sources-fixtures';

const fund = (id: string) => FUNDS.find((f) => f.id === id)!;
const today = '2026-10-23';

test('tickers split into symbol and venue; a US composite suffix is the US', () => {
  assert.deepEqual(splitTicker('RKLB UQ'), { ticker: 'RKLB', exchange: 'US' });
  assert.deepEqual(splitTicker('388720 KS'), { ticker: '388720', exchange: 'KS' });
  assert.deepEqual(splitTicker('ABBN.SW'), { ticker: 'ABBN', exchange: 'SW' });
  assert.deepEqual(splitTicker('TSLA'), { ticker: 'TSLA', exchange: 'US' });
  assert.deepEqual(csvCells('1,"2,3","a ""b"""'), ['1', '2,3', 'a "b"']);
});

test('a US CUSIP becomes its ISIN with the right check digit; anything else does not', () => {
  assert.equal(isinOfCusip('88160R101'), 'US88160R1014'); // Tesla
  assert.equal(isinOfCusip('67066G104'), 'US67066G1040'); // NVIDIA
  assert.equal(isinOfCusip('G51502105'), undefined); // a CINS code is not a US CUSIP
});

test('ARK: each holding row is the quote, with theme, ticker, CUSIP and position', async () => {
  const read = await readFund(fund('ark-arkq'), today, offline);
  assert.equal(read.asOf, '2026-10-23');
  const rows = fundRows(read, (h) => h.ticker.toLowerCase(), today);
  const spcx = rows.find((r) => r.establishes.ids?.ticker === 'SPCX')!;
  assert.equal(spcx.establishes.theme, 'robotics');
  assert.equal(spcx.establishes.ids?.isin, 'US84615Q1031');
  assert.equal(spcx.establishes.size?.basis, 'fund-position');
  assert.ok(spcx.source.quote.includes('SPACE EXPLORATION TECHN-CL A,SPCX'));
  // The money-market sweep line is not a company.
  assert.ok(!rows.some((r) => /TRSY|OBLIG/.test(r.name)));
});

test('Global X: a dated file, found by walking back from today; venue codes kept', async () => {
  const read = await readFund(fund('globalx-ura'), '2026-10-25', offline);
  assert.ok(read.url.endsWith('ura_full-holdings_20261023.csv'), read.url);
  const names = read.holdings.map((h) => h.name);
  for (const n of ['CAMECO CORP', 'OKLO INC', 'X-ENERGY INC', 'NUSCALE POWER CORP'])
    assert.ok(names.includes(n), n);
  const kap = read.holdings.find((h) => h.ticker === 'KAP')!;
  assert.equal(kap.exchange, 'LI');
  assert.equal(kap.marketValueUsd, 228083670.5);
});

test('First Trust and Defiance: HTML tables, currencies dropped, dates read', async () => {
  const grid = await readFund(fund('ft-grid'), today, offline);
  assert.equal(grid.asOf, '2026-10-23');
  assert.ok(grid.holdings.some((h) => h.ticker === 'ABBN' && h.exchange === 'SW'));
  assert.ok(!grid.holdings.some((h) => /Franc/.test(h.name)));
  const qtum = await readFund(fund('defiance-qtum'), today, offline);
  assert.equal(qtum.asOf, '2026-10-26');
  assert.ok(qtum.holdings.some((h) => h.name === 'Horizon Quantum Holdings Ltd'));
  // Defiance prints no market value: theme and identity, never a size.
  assert.ok(fundRows(qtum, () => 'x', today).every((r) => !r.establishes.size));
});

test('State Street: the xlsx is read without a dependency; no market value, no size', async () => {
  const read = await readFund(fund('ssga-rokt'), today, offline);
  assert.equal(read.asOf, '2026-10-22');
  assert.ok(read.holdings.length > 20);
  assert.ok(read.holdings.some((h) => h.ticker === 'LMT'));
  assert.ok(fundRows(read, () => 'x', today).every((r) => !r.establishes.size));
});

test('EDGAR: tickers give the CIK; the float frame gives a quoted size; SIC gives a theme', async () => {
  const tickers = await readTickers(offline);
  const tsla = tickers.rows.find((t) => t.ticker === 'TSLA')!;
  assert.equal(tsla.cik, '1318605');
  const floats = await readFloats(offline);
  const f = floats.get('1318605')!;
  assert.ok(f.usd > 250_000_000);
  const row = floatRow('tesla', f, today);
  assert.equal(row.establishes.size?.basis, 'public-float');
  assert.ok(row.source.quote.startsWith('{"accn":'));
  const filers = await readSicFilers(offline, 1);
  const camtek = filers.find((x) => x.name === 'CAMTEK LTD')!;
  assert.equal(camtek.sic, '3827');
  assert.equal(sicRow('camtek', camtek, today).establishes.theme, 'photonics');
});

test('GLEIF and Wikidata by ISIN: exact or nothing', async () => {
  const lei = await leiForIsin('US88160R1014', offline);
  assert.equal(lei?.lei, '54930043XZGB27CTOV49');
  assert.equal(lei?.country, 'US');
  assert.ok(lei?.quote.startsWith('"lei":"54930043XZGB27CTOV49"'));
  const [qid] = await qidsForIsins(['US88160R1014'], offline);
  assert.equal(qid.qid, 'Q478214');
  assert.equal(qid.label, 'Tesla');
  assert.match(qid.quote, /US88160R1014/);
});
