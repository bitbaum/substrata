/**
 * The market data as the Ask and a page read it: every figure a string to
 * copy, with its date and its source beside it, and the chart a tool hands
 * to the answer (lib/chat/answer-chart.ts). Pure — the tools in
 * lib/chat-tools/market.ts fetch and call these.
 *
 * Nothing here is arithmetic a model could get wrong: returns, extremes,
 * drawdowns, averages and market values come from ./prices/compute.ts; the
 * strings are formatted once, here.
 */
import type { AnswerChart } from '../chat/answer-chart';
import { tickerLabel, type MarketCompany } from './identity';
import { downsample, inRange, priceStats } from './prices/compute';
import type { PriceHistory, Range } from './prices/series';
import type { FactPoint } from './fundamentals/xbrl';
import type { HoldersView } from './holders/build';

/** "1,234.5" — the price as the source gave it, to two decimals (four under one). */
export function money(value: number, currency: string): string {
  const digits = Math.abs(value) < 1 ? 4 : 2;
  return `${value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${currency}`;
}

/** 5.13e12 → "5.13 trillion"; filings report units, readers read words. */
export function bigNumber(value: number): string {
  const abs = Math.abs(value);
  const [div, word] =
    abs >= 1e12
      ? [1e12, 'trillion']
      : abs >= 1e9
        ? [1e9, 'billion']
        : abs >= 1e6
          ? [1e6, 'million']
          : [1, ''];
  const n = (value / div).toLocaleString('en-US', { maximumFractionDigits: 2 });
  return word ? `${n} ${word}` : n;
}

export function priceChart(c: MarketCompany, h: PriceHistory, range: Range): AnswerChart {
  const points = downsample(inRange(h.points, range));
  return {
    id: `price:${h.ticker.exchange}:${h.ticker.symbol}:${range}`,
    block: {
      type: 'chart',
      chart: 'line',
      caption: `${c.name} (${tickerLabel(h.ticker)}), daily close in ${h.currency}, ${points[0]?.date} to ${h.asOf}. Split-adjusted, end of day. Source: ${h.source.name}.`,
      unit: h.currency,
      series: [
        {
          id: h.ticker.symbol,
          label: `${h.ticker.symbol} close`,
          points: points.map((p) => ({ x: p.date, y: p.close })),
        },
      ],
    },
    source: { label: h.source.name, url: h.source.url },
    note: `${h.basis} ${h.delay}${points.length < inRange(h.points, range).length ? ' Drawn with an evenly spaced sample of the daily closes; every figure quoted is computed from all of them.' : ''}`,
  };
}

export interface MarketCapLine {
  display: string;
  close: { date: string; value: number };
  shares: { date: string; value: number; url: string };
}

/** Close × cover-page shares, only where that IS the market value (identity.ts `marketCap`). */
export function marketCap(
  c: MarketCompany,
  h: PriceHistory,
  shares: readonly FactPoint[],
): MarketCapLine | string {
  if (c.marketCap !== true) return `Not computed: ${c.marketCap}.`;
  const last = h.points.at(-1);
  const count = [...shares].sort((a, b) => (a.end < b.end ? -1 : 1)).at(-1);
  if (!last || !count) return 'Not computed: no share count was read from the filings.';
  const value = last.close * count.value;
  return {
    display: `about ${bigNumber(value)} ${h.currency} (the ${money(last.close, h.currency)} close on ${last.date} × ${count.value.toLocaleString('en-US')} shares on the cover of the ${count.form} dated ${count.end})`,
    close: { date: last.date, value: last.close },
    shares: { date: count.end, value: count.value, url: count.url },
  };
}

/** The price_history tool's result: computed figures as strings, and the chart. */
export function priceResult(c: MarketCompany, h: PriceHistory, range: Range, page: string | null) {
  const stats = priceStats(h.points, range)!;
  return {
    company: c.name,
    ticker: tickerLabel(h.ticker),
    ...(page ? { page } : {}),
    currency: h.currency,
    range,
    as_of: h.asOf,
    last_close: `${money(stats.last.close, h.currency)} on ${stats.last.date}`,
    returns: Object.fromEntries(
      stats.returns.map((r) => [
        r.range,
        r.change === null
          ? `not available: ${r.reason}`
          : `${r.display} (${money(r.from!.close, h.currency)} on ${r.from!.date} → ${money(r.to!.close, h.currency)} on ${r.to!.date})`,
      ]),
    ),
    high_52w: stats.high52w
      ? `${money(stats.high52w.close, h.currency)} on ${stats.high52w.date} (highest close)`
      : null,
    low_52w: stats.low52w
      ? `${money(stats.low52w.close, h.currency)} on ${stats.low52w.date} (lowest close)`
      : null,
    max_drawdown: stats.maxDrawdown
      ? `${stats.maxDrawdown.display} from ${money(stats.maxDrawdown.peak.close, h.currency)} on ${stats.maxDrawdown.peak.date} to ${money(stats.maxDrawdown.trough.close, h.currency)} on ${stats.maxDrawdown.trough.date}, within the ${range} range`
      : 'no fall from a peak within the range',
    moving_averages: {
      sma50: stats.sma50 === null ? null : money(stats.sma50, h.currency),
      sma200: stats.sma200 === null ? null : money(stats.sma200, h.currency),
    },
    ...(c.depositary
      ? {
          listing_note: `${tickerLabel(c.ticker)} is a depositary receipt: ${c.depositary}.${c.home ? ` Home listing: ${c.home}.` : ''}`,
        }
      : c.home
        ? { listing_note: `Also trades as ${c.home}.` }
        : {}),
    ...(c.note ? { note_on_history: c.note } : {}),
    source: `${h.source.name}: ${h.source.url}`,
    basis: h.basis,
    delay: h.delay,
    chart: priceChart(c, h, range),
  };
}

/** The holders tool's share bar: named holders plus the typed remainder, never a bare "Other". */
export function holdersChart(c: MarketCompany, v: HoldersView): AnswerChart | null {
  const rows = v.holders.filter((h) => !h.inGroup).slice(0, 10);
  if (!rows.length || !v.remainder) return null;
  const dates = [...new Set(rows.map((r) => r.asOf))].sort();
  return {
    id: `holders:${c.slug}`,
    block: {
      type: 'chart',
      chart: 'share',
      caption: `Who holds ${c.name}: holders named in filings, each as of its own date (${dates[0]} to ${dates.at(-1)}); the rest are holders each below 5%.`,
      rows: rows.map((r) => ({ label: r.name, share: r.percent })),
      other: v.remainder.percent,
    },
    otherLabel: v.remainder.short,
    source: { label: 'SEC EDGAR filings', url: rows[0].source.url },
    note: v.remainder.explanation,
  };
}
