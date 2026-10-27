/**
 * Share prices: the Yahoo chart parser on recorded responses, every
 * computation on known numbers, the fallback chain, and the chart the Ask
 * draws. No network: test/market-fixtures.ts serves recorded bytes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChartBlock } from '@bitbaum/chatkit';

import { fixture, MARKET_DEPS } from './market-fixtures';
import { bySlug } from '../lib/market-data/identity';
import { parseYahooChart, yahooChartUrl, yahooSymbol } from '../lib/market-data/prices/yahoo';
import {
  downsample,
  extremes52w,
  formatChange,
  maxDrawdown,
  sma,
  smaSeries,
  windowReturn,
} from '../lib/market-data/prices/compute';
import { fetchPrices } from '../lib/market-data/prices/chain';
import { parseRange, rangeStart } from '../lib/market-data/prices/series';
import { priceHistory, resetLivePrices } from '../lib/market-data/prices/store';
import { marketCap, priceResult } from '../lib/market-data/present';
import { resetPacing } from '../lib/sources/http';

const nvda = parseYahooChart(fixture('yahoo-nvda-1y.json'));
const P = (pairs: [string, number][]) => pairs.map(([date, close]) => ({ date, close }));

test('the chart parser reads a year of NVIDIA closes, in order, split-adjusted, rounded', () => {
  assert.equal(nvda.currency, 'USD');
  assert.equal(nvda.points.length, 251);
  assert.deepEqual(nvda.points.at(-1), { date: '2026-10-23', close: 210.96 });
  assert.equal(nvda.points[0].close, 186.26);
  for (let i = 1; i < nvda.points.length; i++)
    assert.ok(nvda.points[i - 1].date < nvda.points[i].date, 'ascending, one row per day');
});

test('a Tokyo listing is dated in Tokyo, in yen', () => {
  const tel = parseYahooChart(fixture('yahoo-8035-5d.json'));
  assert.equal(tel.currency, 'JPY');
  assert.ok(tel.points.length >= 4);
  for (const p of tel.points)
    assert.ok(
      ![0, 6].includes(new Date(`${p.date}T12:00:00Z`).getUTCDay()),
      `${p.date} is a weekday`,
    );
  assert.throws(
    () =>
      parseYahooChart(
        '{"chart":{"result":null,"error":{"code":"Not Found","description":"No data found"}}}',
      ),
    /No data found/,
  );
});

test('symbols per venue', () => {
  assert.equal(yahooSymbol(bySlug('tokyo-electron')!.ticker), '8035.T');
  assert.equal(yahooSymbol(bySlug('kazatomprom')!.ticker), 'KAP.IL');
  assert.equal(yahooSymbol(bySlug('intel-foundry')!.ticker), 'INTC');
  assert.match(yahooChartUrl(bySlug('asml')!.ticker), /chart\/ASML\?range=5y&interval=1d$/);
});

test('returns compare the newest close with the last close on or before the window start', () => {
  const pts = P([
    ['2025-12-30', 90],
    ['2025-12-31', 100],
    ['2026-01-02', 104],
    ['2026-09-22', 120],
    ['2026-10-23', 110],
  ]);
  const ytd = windowReturn(pts, 'YTD');
  assert.equal(ytd.from?.date, '2025-12-31', 'YTD starts at last year’s last close');
  assert.equal(ytd.display, '+10.0%');
  const m1 = windowReturn(pts, '1M');
  assert.equal(m1.from?.date, '2026-09-22');
  assert.equal(m1.display, '−8.3%');
  const y5 = windowReturn(pts, '5Y');
  assert.equal(y5.change, null, 'a history shorter than the window has no return');
  assert.match(y5.reason!, /starts on 2025-12-30/);
  const year = windowReturn(nvda.points, '1Y');
  assert.equal(
    year.from?.date,
    nvda.points[0].date,
    'the source’s year ends a few sessions short: the first close starts it',
  );
  assert.equal(year.display, formatChange(210.96 / 186.26 - 1));
});

test('extremes, drawdown and averages are computed, with their dates', () => {
  const pts = P([
    ['2026-01-02', 100],
    ['2026-02-02', 150],
    ['2026-03-02', 90],
    ['2026-04-01', 120],
  ]);
  assert.deepEqual(extremes52w(pts), {
    high: { close: 150, date: '2026-02-02' },
    low: { close: 90, date: '2026-03-02' },
  });
  const dd = maxDrawdown(pts)!;
  assert.equal(dd.display, '−40.0%');
  assert.equal(dd.peak.date, '2026-02-02');
  assert.equal(dd.trough.date, '2026-03-02');
  assert.equal(
    maxDrawdown(
      P([
        ['2026-01-01', 1],
        ['2026-01-02', 2],
      ]),
    ),
    null,
    'only rises: no drawdown',
  );
  assert.equal(sma(pts, 2), 105);
  assert.equal(sma(pts, 5), null);
  assert.deepEqual(
    smaSeries(pts, 2).map((p) => p.close),
    [125, 120, 105],
  );
  assert.equal(formatChange(0), '0.0%');
  assert.equal(formatChange(0.1234), '+12.3%');
});

test('a chart sample keeps real closes, the first and the last, within chatkit’s 120 points', () => {
  const s = downsample(nvda.points);
  assert.equal(s.length, 120);
  assert.deepEqual(s[0], nvda.points[0]);
  assert.deepEqual(s.at(-1), nvda.points.at(-1));
  for (const p of s) assert.ok(nvda.points.includes(p));
});

test('ranges are read from what people type', () => {
  assert.equal(parseRange('1y'), '1Y');
  assert.equal(parseRange('five years'), '5Y');
  assert.equal(parseRange('ytd'), 'YTD');
  assert.equal(parseRange(undefined), '1Y');
  assert.equal(rangeStart('3M', '2026-10-23'), '2026-07-23');
});

test('the chain falls back to the second edge, and says why when both fail', async () => {
  resetPacing();
  const seen: string[] = [];
  const flaky: typeof fetch = async (input, init) => {
    seen.push(String(input));
    if (String(input).includes('query1')) return new Response('down', { status: 503 });
    return MARKET_DEPS.fetch(input, init);
  };
  const got = await fetchPrices(bySlug('nvidia')!.ticker, { ...MARKET_DEPS, fetch: flaky });
  assert.ok(!('failed' in got));
  assert.equal(got.points.length, 251);
  assert.match(seen[1], /query2/);
  const none = await fetchPrices(bySlug('amd')!.ticker, MARKET_DEPS);
  assert.ok('failed' in none);
  assert.equal(none.failed.length, 2);
  assert.match(none.failed[0], /404/);
});

test('with nothing stored, a reader gets a live read labelled as such, or the reason', async () => {
  resetLivePrices();
  resetPacing();
  const h = await priceHistory(bySlug('nvidia')!.ticker, {
    ...MARKET_DEPS,
    stored: async () => null,
  });
  assert.ok(!('unavailable' in h));
  assert.equal(h.via, 'live');
  assert.equal(h.asOf, '2026-10-23');
  assert.match(h.basis, /split/);
  assert.match(h.delay, /not real time/);
  const gone = await priceHistory(bySlug('lynas-rare-earths')!.ticker, {
    ...MARKET_DEPS,
    stored: async () => null,
  });
  assert.ok('unavailable' in gone);
  assert.match(gone.reason, /could not be read/);
});

test('the Ask gets strings to copy and a line chart chatkit accepts', async () => {
  resetLivePrices();
  const c = bySlug('nvidia')!;
  const h = await priceHistory(c.ticker, { ...MARKET_DEPS, stored: async () => null });
  assert.ok(!('unavailable' in h));
  const out = priceResult(c, h, '1Y', '/markets/nvidia');
  assert.equal(out.last_close, '210.96 USD on 2026-10-23');
  assert.match(
    out.returns['1Y'],
    /^\+13\.3% \(186\.26 USD on \d{4}-\d{2}-\d{2} → 210\.96 USD on 2026-10-23\)$/,
  );
  assert.match(out.returns['5Y'], /^not available/);
  assert.ok(parseChartBlock(out.chart.block), 'a valid chatkit line block');
  assert.match(out.chart.block.caption, /Yahoo Finance/);
  assert.equal(
    marketCap(bySlug('tsmc')!, h, []),
    'Not computed: the listing is a depositary receipt, so its price times the share count is not the market value without the ratio.',
  );
});
