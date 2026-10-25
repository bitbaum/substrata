/**
 * The Yahoo Finance chart endpoint, read as daily closes.
 *
 * `https://query1.finance.yahoo.com/v8/finance/chart/<symbol>?range=5y&interval=1d`
 * answers JSON: `timestamp[]` (the session's opening second, UTC) beside
 * `indicators.quote[0].close[]` — SPLIT-ADJUSTED closes (NVIDIA's June 2024
 * ten-for-one split is already divided out of the earlier closes) with
 * dividends NOT added back — and `meta.currency`, `meta.exchangeTimezoneName`.
 * A session that has no close yet is `null` and is dropped here, never filled.
 *
 * Only the parsing lives here, so it is tested on a recorded response
 * (test/fixtures/market/); the chain in ./chain.ts does the fetching.
 */
import type { Exchange, Ticker } from '../identity';
import type { PricePoint } from './series';

/** Yahoo's suffix per exchange: the same company is a different symbol per venue. */
const SUFFIX: Record<Exchange, string> = {
  NASDAQ: '',
  NYSE: '',
  'Euronext Amsterdam': '.AS',
  'Euronext Paris': '.PA',
  Tokyo: '.T',
  Xetra: '.DE',
  ASX: '.AX',
  // LSE's International Order Book, where Kazatomprom's GDRs trade in dollars.
  LSE: '.IL',
};

export const yahooSymbol = (t: Ticker) => `${t.symbol}${SUFFIX[t.exchange]}`;

export const yahooChartUrl = (t: Ticker, host = 'query1') =>
  `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol(t))}?range=5y&interval=1d`;

/** The page a reader can open to check a figure. */
export const yahooQuotePage = (t: Ticker) =>
  `https://finance.yahoo.com/quote/${encodeURIComponent(yahooSymbol(t))}/history/`;

interface ChartJson {
  chart?: {
    result?: Array<{
      meta?: { currency?: string; exchangeTimezoneName?: string; symbol?: string };
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }> | null;
    error?: { code?: string; description?: string } | null;
  };
}

/** The trading day of a session in the exchange's own time zone, YYYY-MM-DD. */
export function sessionDay(epochSeconds: number, timeZone = 'UTC'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(epochSeconds * 1000));
  return parts;
}

export interface ParsedChart {
  points: PricePoint[];
  currency: string | null;
  symbol: string | null;
}

/** Parse a chart response. Throws with Yahoo's own words when it answered an error. */
export function parseYahooChart(body: string): ParsedChart {
  const json = JSON.parse(body) as ChartJson;
  const result = json.chart?.result?.[0];
  if (!result) {
    const e = json.chart?.error;
    throw new Error(`Yahoo chart: ${e?.description ?? e?.code ?? 'no result'}`);
  }
  const zone = result.meta?.exchangeTimezoneName ?? 'UTC';
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const byDay = new Map<string, number>();
  (result.timestamp ?? []).forEach((t, i) => {
    const close = closes[i];
    if (typeof close !== 'number' || !Number.isFinite(close) || close <= 0) return;
    // Four decimals: the float noise in "210.9600067138672" is not a price.
    byDay.set(sessionDay(t, zone), Math.round(close * 10_000) / 10_000);
  });
  return {
    points: [...byDay]
      .map(([date, close]) => ({ date, close }))
      .sort((a, b) => (a.date < b.date ? -1 : 1)),
    currency: result.meta?.currency ?? null,
    symbol: result.meta?.symbol ?? null,
  };
}
