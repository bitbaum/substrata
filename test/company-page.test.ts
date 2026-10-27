/**
 * The company page's market frame (docs/design/company-page.md), tested where
 * it is decided: the pure view-model builders in lib/company-page, the join
 * from a page slug to a listing (lib/market-data/company.ts), and the Ask's
 * charts linking to the page. Recorded bytes only (test/market-fixtures.ts);
 * the layout itself is scripts/ux/company-layout.mjs, in a browser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fixture } from './market-fixtures';
import { COMPANY_SECTION_ORDER } from '../lib/company-sections';
import {
  UNCHECKED_CAP,
  listingFromKey,
  marketCompanyFor,
  pageSlugFor,
  venueExchange,
} from '../lib/market-data/company';
import { bySlug } from '../lib/market-data/identity';
import { buildFundamentals } from '../lib/market-data/fundamentals/read';
import type { CompanyFacts } from '../lib/market-data/fundamentals/xbrl';
import { parseYahooChart } from '../lib/market-data/prices/yahoo';
import { BASIS, DELAY, RANGES, type PriceHistory } from '../lib/market-data/prices/series';
import { holdersChart, priceChart } from '../lib/market-data/present';
import {
  quoteOf,
  rangeView,
  rangeViews,
  returnsTable,
  yearRange,
} from '../lib/company-page/price-view';
import { keyStatCells } from '../lib/company-page/key-stats';
import { financialsView, scaled } from '../lib/company-page/financials';
import { businessGroups, ownerRows } from '../lib/company-page/business';
import { PEERS_SHOWN, peerRow, peerSet } from '../lib/company-page/peers';
import type { Neighbour } from '../lib/graph/index';

const nvdaPoints = parseYahooChart(fixture('yahoo-nvda-1y.json')).points;
const nvdaFacts = buildFundamentals(
  JSON.parse(fixture('companyfacts-nvda.json')) as CompanyFacts,
  '2026-10-25T00:00:00Z',
);
const NVDA = bySlug('nvidia')!;
const TSMC = bySlug('tsmc')!;
const history = (points = nvdaPoints): PriceHistory => ({
  ticker: NVDA.ticker,
  currency: 'USD',
  points,
  source: {
    name: 'Yahoo Finance',
    url: 'https://finance.yahoo.com/quote/NVDA/history/',
    terms: '',
  },
  asOf: points.at(-1)!.date,
  fetchedAt: '2026-10-25T00:00:00Z',
  basis: BASIS,
  delay: DELAY,
  via: 'live',
});
const P = (pairs: [string, number][]) => pairs.map(([date, close]) => ({ date, close }));

test('the frame comes first after the header, in the documented order', () => {
  assert.deepEqual(COMPANY_SECTION_ORDER.slice(0, 7), [
    'price',
    'key-stats',
    'chain-role',
    'constrained-by',
    'constrains',
    'financials',
    'chokepoints',
  ]);
  const at = (id: string) => COMPANY_SECTION_ORDER.indexOf(id as never);
  assert.ok(at('ownership') < at('business') && at('business') < at('events'));
  assert.ok(at('peers') > at('same-layer'));
});

test('quote: last close, the day’s change against the session before, both dated', () => {
  const q = quoteOf(
    P([
      ['2026-10-22', 200],
      ['2026-10-23', 210],
    ]),
    'USD',
  )!;
  assert.equal(q.close, '210.00 USD');
  assert.equal(q.date, '2026-10-23');
  assert.deepEqual(q.change, { display: '+5.0%', direction: 'up', from: '2026-10-22' });
  assert.equal(quoteOf(P([['2026-10-23', 1]]), 'USD')!.change, null, 'one close: no change');
  assert.equal(quoteOf([], 'USD'), null);
});

test('ranges: every range, at most 120 real closes each, figures computed from all closes', () => {
  const views = rangeViews(nvdaPoints, 'USD');
  assert.deepEqual(
    views.map((v) => v.range),
    [...RANGES],
  );
  for (const v of views) {
    assert.ok(v.points.length <= 120);
    for (const p of v.points)
      assert.ok(
        nvdaPoints.some((q) => q.date === p.x && q.close === p.y),
        'never averaged',
      );
  }
  const year = views.find((v) => v.range === '1Y')!;
  assert.match(year.change, /^[+−]\d+\.\d%$/);
  assert.match(year.changeDetail, /^since [\d,.]+ USD on \d{4}-\d{2}-\d{2}$/);
  // The recorded history is one year: five years is not computed, and says why.
  const five = views.find((v) => v.range === '5Y')!;
  assert.equal(five.change, 'Not computed');
  assert.equal(five.direction, null);
  assert.match(five.changeDetail, /history starts on/);
});

test('range figures on known numbers: return, span and the largest fall', () => {
  const pts = P([
    ['2026-01-02', 100],
    ['2026-02-02', 150],
    ['2026-03-02', 90],
    ['2026-04-01', 120],
  ]);
  const v = rangeView(pts, '3M', 'USD');
  // 3M from 2026-04-01 starts 2026-01-01; the history starts the next day, within the grace week.
  assert.equal(v.change, '+20.0%', '100 on 2026-01-02 → 120 on 2026-04-01');
  assert.equal(v.direction, 'up');
  assert.equal(v.drawdown, '−40.0%, 2026-02-02 to 2026-03-02');
  assert.match(v.span, /^90\.00 USD \(2026-03-02\) to 150\.00 USD \(2026-02-02\)$/);
});

test('returns table: one row per range; a short history says “Not computed” with the reason', () => {
  const rows = returnsTable(
    P([
      ['2026-09-01', 10],
      ['2026-10-01', 12],
    ]),
    'USD',
  );
  assert.equal(rows.length, RANGES.length);
  assert.deepEqual(rows[0], {
    range: '1M',
    display: '+20.0%',
    direction: 'up',
    detail: '10.00 USD on 2026-09-01 → 12.00 USD on 2026-10-01',
  });
  const year = rows.find((r) => r.range === '1Y')!;
  assert.equal(year.display, 'Not computed');
  assert.match(year.detail, /history starts on 2026-09-01/);
});

test('52-week range: lowest and highest close, and where the last sits', () => {
  const y = yearRange(
    P([
      ['2026-01-02', 100],
      ['2026-05-02', 200],
      ['2026-10-01', 150],
    ]),
    'USD',
  )!;
  assert.equal(y.low, '100.00 USD on 2026-01-02');
  assert.equal(y.high, '200.00 USD on 2026-05-02');
  assert.equal(y.position, 50);
});

test('key statistics: eight equal cells, market value computed only where it is the value', () => {
  const { cells, unavailable } = keyStatCells(NVDA, nvdaFacts, history());
  assert.equal(unavailable, null);
  assert.equal(cells.length, 8, 'two rows of four, four of two: no cell left hanging');
  const cap = cells[0];
  assert.equal(cap.label, 'Market value');
  assert.match(cap.value, /^[\d.]+ (trillion|billion) USD$/);
  assert.match(cap.href!, /sec\.gov/);
  const revenue = cells.find((c) => c.id === 'revenue')!;
  assert.match(revenue.value, /billion USD$/);
  assert.match(revenue.detail, /^FY\d{4} \(year to \d{4}-\d{2}-\d{2}\)/);
  assert.match(revenue.detail, /on the year before/);
  assert.match(revenue.href!, /^https:\/\/www\.sec\.gov\/Archives\//);

  // An ADR: the price times the share count is not the value, and the cell says why.
  const adr = keyStatCells(TSMC, nvdaFacts, history()).cells[0];
  assert.equal(adr.value, 'Not computed');
  assert.match(adr.detail, /depositary receipt/);
  assert.equal(adr.missing, true);

  const noPrice = keyStatCells(NVDA, nvdaFacts, {
    unavailable: true,
    ticker: NVDA.ticker,
    reason: 'Yahoo answered 503.',
  }).cells[0];
  assert.equal(noPrice.value, 'Not computed');
  assert.match(noPrice.detail, /No price to multiply: Yahoo answered 503/);

  const none = keyStatCells(
    NVDA,
    { unavailable: true, company: 'X', reason: 'It does not file with the SEC.' },
    history(),
  );
  assert.deepEqual(none, { cells: [], unavailable: 'It does not file with the SEC.' });
});

test('financials: five fiscal years, scaled to billions, growth and margin computed', () => {
  const view = financialsView(nvdaFacts);
  assert.ok(typeof view !== 'string');
  assert.equal(view.years.length, 5);
  assert.equal(view.currency, 'USD');
  assert.equal(view.scaleWord, 'bn');
  assert.deepEqual(
    view.years.map((y) => y.label),
    [...view.years].sort((a, b) => (a.end < b.end ? -1 : 1)).map((y) => y.label),
    'oldest first',
  );
  const last = view.years.at(-1)!;
  const prev = view.years.at(-2)!;
  const growth = Math.round((last.revenue! / prev.revenue! - 1) * 1000) / 10;
  assert.equal(last.growth, `${growth >= 0 ? '+' : '−'}${Math.abs(growth).toFixed(1)}%`);
  assert.equal(last.margin, `${((last.netIncome! / last.revenue!) * 100).toFixed(1)}%`);
  assert.equal(scaled(last.revenue, view), Math.round((last.revenue! / 1e9) * 10) / 10);
  assert.equal(financialsView({ unavailable: true, company: 'X', reason: 'No XBRL.' }), 'No XBRL.');
});

const node = (id: string, name: string, iso2: string[] = []) => ({
  id: id as `company:${string}`,
  name,
  inDirectory: false,
  kind: id.split(':')[0],
  iso2,
});
const rel = (
  from: string,
  to: string,
  type: Neighbour['relation']['type'],
  extra: Partial<Neighbour['relation']> = {},
): Neighbour['relation'] => ({
  id: `${from}|${type}|${to}|2024`,
  from: from as `company:${string}`,
  to: to as `company:${string}`,
  type,
  grade: 'stated',
  asOf: '2024',
  evidence: [{ source: 'https://pubs.usgs.gov/myb/x.pdf', quote: 'q', readOn: '2026-10-24' }],
  ...extra,
});

test('business: customers, suppliers and competitors always; an empty one names what fills it', () => {
  const groups = businessGroups('company:x', 'X Corp', []);
  assert.deepEqual(
    groups.map((g) => g.id),
    ['customers', 'suppliers', 'competitors'],
  );
  for (const g of groups) {
    assert.equal(g.rows.length, 0);
    assert.match(g.empty!.missing, /of X Corp is recorded as a named company with a source yet/);
    assert.ok(g.empty!.sources.length > 0, `${g.id}: says which documents would fill it`);
  }
  const quoted = businessGroups('company:x', 'X Corp', [], { suppliers: true });
  assert.equal(quoted.find((g) => g.id === 'suppliers')!.seeAlso!.href, '#dependencies');
  assert.equal(quoted.find((g) => g.id === 'customers')!.seeAlso, undefined);
});

test('business: rows of one anatomy, each from its side, ownership of IT left to “Who owns it”', () => {
  const me = 'company:x';
  const n: Neighbour[] = [
    {
      node: node('company:jv', 'A Joint Venture'),
      relation: rel(me, 'company:jv', 'owns', { share: { value: 50, unit: 'percent' } }),
      direction: 'out',
    },
    {
      node: node('company:buyer', 'Buyer Co'),
      relation: rel('company:buyer', me, 'buys_from', { grade: 'corroborated' }),
      direction: 'in',
    },
    {
      node: node('country:cn', 'China', ['CN']),
      relation: rel(me, 'country:cn', 'ships_to', {
        volume: { value: 1200, unit: 't', period: '2024', commodity: 'uranium' },
      }),
      direction: 'out',
    },
    {
      node: node('company:parent', 'Parent plc'),
      relation: rel('company:parent', me, 'owns', { share: { value: 60, unit: 'percent' } }),
      direction: 'in',
    },
  ];
  const groups = businessGroups(me, 'X', n);
  const customers = groups.find((g) => g.id === 'customers')!;
  assert.equal(customers.rows.length, 2);
  assert.deepEqual(
    customers.rows.map((r) => [r.name, r.relation, r.grade, r.amount]),
    [
      ['Buyer Co', 'sells to', 'two sources', undefined],
      ['China', 'ships to', 'stated', '1,200 t of uranium, 2024'],
    ],
  );
  assert.ok(customers.rows[1].href, 'a country end links to its page');
  assert.equal(customers.rows[0].source!.label, 'pubs.usgs.gov');
  const stakes = groups.find((g) => g.id === 'stakes')!;
  assert.deepEqual(
    stakes.rows.map((r) => [r.name, r.amount]),
    [['A Joint Venture', '50%']],
  );
  assert.ok(!groups.some((g) => g.rows.some((r) => r.name === 'Parent plc')));
  assert.deepEqual(
    ownerRows(me, n).map((r) => [r.name, r.relation, r.amount]),
    [['Parent plc', 'owned by', '60%']],
  );
});

test('listing join: seed first, then the universe ticker on a venue the price source reads', () => {
  assert.equal(marketCompanyFor('nvidia'), NVDA);
  // The universe's Kazatomprom is the seed's checked row (KAP on LSE’s IOB).
  assert.equal(marketCompanyFor('nac-kazatomprom-jsc'), bySlug('kazatomprom'));
  const spacex = marketCompanyFor('spacex');
  assert.ok(spacex, 'a tier B company with a ticker gets market data');
  assert.equal(spacex.ticker.exchange, 'US');
  assert.equal(spacex.marketCap, UNCHECKED_CAP);
  assert.equal(typeof spacex.cik, 'number');
  assert.equal(marketCompanyFor('akbastau-jv'), null, 'a stub has no listing');
  assert.equal(venueExchange('CN'), null, 'every Canadian venue: not guessed');
  assert.equal(venueExchange('Nasdaq'), 'NASDAQ');
  assert.deepEqual(listingFromKey('x', 'X', { ticker: '700', exchange: 'HK' })!.ticker, {
    exchange: 'Hong Kong',
    symbol: '0700',
  });
  assert.equal(listingFromKey('x', 'X', { ticker: 'ABC', exchange: 'CH' }), null);
  assert.equal(pageSlugFor(bySlug('kazatomprom')!), 'nac-kazatomprom-jsc');
  assert.equal(pageSlugFor(NVDA), 'nvidia');
});

test('peers: same step for a profiled company, same theme for an identified one, never itself', () => {
  const a = peerSet('nvidia');
  assert.match(a.basis, /same step of the chain/);
  assert.ok(a.peers.length > 0 && a.peers.length <= PEERS_SHOWN);
  assert.ok(!a.peers.some((p) => p.company.ticker.symbol === 'NVDA'));
  const lines = a.peers.map((p) => `${p.company.ticker.exchange}:${p.company.ticker.symbol}`);
  assert.equal(new Set(lines).size, lines.length, 'one row per listing');
  const b = peerSet('oklo');
  assert.match(b.basis, /same theme/);
  assert.ok(!b.peers.some((p) => p.slug === 'oklo'));
  assert.deepEqual(peerSet('akbastau-jv').peers, []);
});

test('peer row: last close, one-year return and a sparkline of real closes, or why not', () => {
  const peer = { slug: 'nvidia', name: 'NVIDIA', company: NVDA };
  const row = peerRow(peer, nvdaPoints, 'USD');
  assert.equal(row.ticker, 'NVDA (NASDAQ)');
  assert.equal(row.closeDate, nvdaPoints.at(-1)!.date);
  assert.ok(row.spark.length > 1 && row.spark.length <= 60);
  const none = peerRow(peer, null, '', 'prices unavailable');
  assert.deepEqual(
    [none.close, none.closeDate, none.oneYear, none.spark],
    ['Not available', 'prices unavailable', '—', []],
  );
});

test('the Ask’s charts link to the company page they belong on', () => {
  const chart = priceChart(NVDA, history(), '1Y', '/markets/nvidia');
  assert.deepEqual(chart.page, { label: 'Open NVIDIA', href: '/markets/nvidia#price' });
  assert.equal(priceChart(NVDA, history(), '1Y').page, undefined);
  const holders = holdersChart(
    NVDA,
    {
      company: 'NVIDIA',
      holders: [
        {
          name: 'BlackRock',
          percent: 7.43,
          shares: null,
          kind: 'institution',
          asOf: '2026-03-23',
          source: { label: 'DEF 14A', url: 'https://www.sec.gov/x' },
        },
      ],
      remainder: {
        label: 'Other holders (each below 5%; not itemised in filings)',
        short: 'Others, each below 5%',
        percent: 92.57,
        explanation: 'e',
      },
      remainderWhyNot: null,
      insiders: [],
      institutionsNote: '',
      notes: [],
    },
    '/markets/nvidia',
  )!;
  assert.equal(holders.page!.href, '/markets/nvidia#ownership');
  assert.equal(holders.otherLabel, 'Others, each below 5%');
});
