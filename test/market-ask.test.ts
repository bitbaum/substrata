/**
 * The Ask's market tools: the identity seam, the planner, and the tools run
 * through the registry on recorded responses — a price question draws a line
 * chart, a holders question a share bar with the rest named, and every
 * figure the model reads is a computed string with its source.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MARKET_DEPS } from './market-fixtures';
import {
  MARKET_SEED,
  byCik,
  bySlug,
  byTicker,
  findMarketCompany,
  marketCompaniesIn,
} from '../lib/market-data/identity';
import { marketCalls, rangeIn } from '../lib/chat-agent/market-ask';
import { runTool } from '../lib/chat-tools/registry';
import { emptyLedger } from '../lib/chat-tools/ledger';
import { resetLivePrices } from '../lib/market-data/prices/store';
import { resetSnapshots } from '../lib/market-data/snapshots';
import { resetPacing } from '../lib/sources/http';

test('the seed: one listing each, unique, and the lookups the universe will replace', () => {
  assert.equal(MARKET_SEED.length, 28);
  assert.equal(new Set(MARKET_SEED.map((c) => `${c.ticker.exchange}:${c.ticker.symbol}`)).size, 28);
  assert.equal(new Set(MARKET_SEED.map((c) => c.slug)).size, 28);
  assert.equal(byTicker({ exchange: 'NYSE', symbol: 'TSM' })?.slug, 'tsmc');
  assert.equal(byCik(1045810)?.name, 'NVIDIA');
  assert.equal(
    bySlug('intel-foundry')?.ticker.symbol,
    'INTC',
    'a division resolves to its listed parent',
  );
  assert.equal(findMarketCompany('NVDA')?.slug, 'nvidia');
  assert.equal(findMarketCompany('Taiwan Semiconductor')?.slug, 'tsmc');
  assert.deepEqual(
    marketCompaniesIn('Compare AMD and NVIDIA revenue growth').map((c) => c.slug),
    ['amd', 'nvidia'],
  );
  assert.deepEqual(
    marketCompaniesIn('Is AI demand good for Air Liquide?').map((c) => c.slug),
    ['air-liquide'],
    '"AI" is not a ticker here',
  );
  for (const c of MARKET_SEED)
    if (c.depositary)
      assert.notEqual(
        c.marketCap,
        true,
        `${c.slug}: an ADR’s price × shares is not its market value`,
      );
});

test('the planner reads the question: price, holders, financials, and the range', () => {
  const names = (q: string) => marketCalls(q).map((c) => `${c.name} ${c.args}`);
  assert.deepEqual(names('How has NVIDIA stock done over the last year?'), [
    'price_history {"company":"NVIDIA","range":"1Y"}',
  ]);
  assert.deepEqual(names('Who owns NVIDIA?'), ['holders {"company":"NVIDIA"}']);
  assert.deepEqual(names('Compare AMD and NVIDIA revenue growth'), [
    'fundamentals {"company":"AMD","metrics":"revenue,netIncome"}',
    'fundamentals {"company":"NVIDIA","metrics":"revenue,netIncome"}',
  ]);
  assert.deepEqual(names("What is TSMC's market cap trend?"), [
    'price_history {"company":"TSMC","range":"5Y"}',
  ]);
  assert.deepEqual(
    names('Which companies does Kazatomprom hold stakes in?'),
    [],
    'what it holds is the graph’s question',
  );
  assert.equal(rangeIn('NVIDIA year to date'), 'YTD');
  assert.equal(rangeIn('over the past 3 months'), '3M');
});

test('price_history: computed strings for the model, a line chart for the reader', async () => {
  resetLivePrices();
  resetSnapshots();
  resetPacing();
  const env = { ledger: emptyLedger(), market: MARKET_DEPS };
  const { result } = await runTool('price_history', { company: 'NVDA', range: '1Y' }, env);
  const out = JSON.parse(result);
  assert.equal(out.last_close, '210.96 USD on 2026-10-23');
  assert.match(out.returns['1Y'], /^\+13\.3%/);
  assert.match(out.source, /^Yahoo Finance: https:\/\/finance\.yahoo\.com\/quote\/NVDA/);
  assert.match(out.delay, /not real time/);
  assert.match(
    out.market_value,
    /^about [\d.]+ trillion USD \(the 210\.96 USD close on 2026-10-23 × [\d,]+ shares on the cover of the 10-Q dated /,
  );
  assert.equal(out.chart_shown, 'The reader sees this chart under your answer.');
  assert.ok(!('chart' in out), 'the chart goes to the answer, not back to the model');
  assert.equal(env.ledger.charts.length, 1);
  assert.equal(env.ledger.charts[0].block.chart, 'line');
  assert.ok(
    env.ledger.records.get('/markets/nvidia'),
    'the company page is among the records read',
  );
});

test('holders: the rest is named for what it is, and drawn under that name', async () => {
  resetSnapshots();
  resetPacing();
  const env = { ledger: emptyLedger(), market: MARKET_DEPS };
  const out = JSON.parse((await runTool('holders', { company: 'NVIDIA' }, env)).result);
  assert.equal(out.holders[0].name, 'BlackRock, Inc.');
  assert.match(
    out.holders[0].source,
    /^Proxy statement \(DEF 14A\) filed 2026-05-12: https:\/\/www\.sec\.gov\//,
  );
  assert.deepEqual(out.rest.label, 'Other holders (each below 5%; not itemised in filings)');
  assert.equal(out.rest.percent, '81.32%');
  const chart = env.ledger.charts[0];
  assert.equal(chart.block.chart, 'share');
  assert.equal(chart.otherLabel, 'Others, each below 5%');
});

test('fundamentals and companies outside the seed answer with a reason, never a blank', async () => {
  resetSnapshots();
  const env = { ledger: emptyLedger(), market: MARKET_DEPS };
  const nv = JSON.parse(
    (await runTool('fundamentals', { company: 'NVIDIA', metrics: 'revenue' }, env)).result,
  );
  assert.equal(nv.metrics[0].annual_newest_first[0].value, '215.94 billion USD');
  assert.match(nv.metrics[0].growth_year_on_year[0], /^\+[\d.]+%, fiscal year ending 2026-01-25/);
  const tel = JSON.parse(
    (await runTool('fundamentals', { company: 'Tokyo Electron' }, env)).result,
  );
  assert.match(tel.unavailable, /does not file financial statements with the SEC/);
  const acme = JSON.parse(
    (await runTool('price_history', { company: 'Acme Widgets' }, env)).result,
  );
  assert.match(acme.error, /No listed company/);
  assert.match(acme.note, /web_search/);
});
