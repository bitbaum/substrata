/**
 * The shape every price reader returns, and the ranges a reader may ask for.
 *
 * Kept free of I/O so the page, the chat tool and the tests share one type.
 * The page-UI builder consumes `PriceHistory` and `PriceStats` (./compute.ts)
 * exactly as they are; the chat tool turns them into a chartkit line block.
 */
import type { Ticker } from '../identity';

export interface PricePoint {
  /** The trading day, YYYY-MM-DD, in the exchange's own time zone. */
  date: string;
  /** The day's closing price in `currency`, split-adjusted (see BASIS). */
  close: number;
}

export interface PriceSource {
  /** Who served the closes, by name ("Yahoo Finance"). */
  name: string;
  /** A page a reader can open to check the figures. */
  url: string;
  /** What the figures are, in a line, including the terms we read them under. */
  terms: string;
}

/** What a stored close is. Said with every figure, because it changes what a return means. */
export const BASIS =
  'Daily closing prices adjusted for share splits; dividends are not added back, so returns are price returns.';

/** Said with every figure: these are end-of-day closes, never a live quote. */
export const DELAY = 'End-of-day closes, refreshed once a day; not real time.';

export interface PriceHistory {
  ticker: Ticker;
  currency: string;
  points: PricePoint[];
  source: PriceSource;
  /** The newest close's trading day. */
  asOf: string;
  /** When the closes were fetched (ISO). */
  fetchedAt: string;
  basis: typeof BASIS;
  delay: typeof DELAY;
  /** Where the figures came from this time: the database the cron fills, or a live read. */
  via: 'stored' | 'live';
}

/** Why there is no history: said, never a blank. */
export interface PriceUnavailable {
  unavailable: true;
  ticker: Ticker | null;
  reason: string;
}

export const RANGES = ['1M', '3M', '6M', 'YTD', '1Y', '5Y'] as const;
export type Range = (typeof RANGES)[number];

/** "1y", "12 months", "year" → 1Y. Unknown words fall back to 1Y. */
export function parseRange(raw: unknown): Range {
  const s = String(raw ?? '')
    .toUpperCase()
    .replace(/\s+/g, '');
  if ((RANGES as readonly string[]).includes(s)) return s as Range;
  if (/^(YTD|THISYEAR|YEARTODATE)/.test(s)) return 'YTD';
  if (/^(5Y|5YEARS?|FIVEYEARS?|60M)/.test(s)) return '5Y';
  if (/^(6M|6MONTHS?|HALFAYEAR|HALFYEAR)/.test(s)) return '6M';
  if (/^(3M|3MONTHS?|QUARTER)/.test(s)) return '3M';
  if (/^(1M|1MONTH|MONTH|30D)/.test(s)) return '1M';
  return '1Y';
}

/** The first day a range covers, counted back from the newest close. */
export function rangeStart(range: Range, asOf: string): string {
  const d = new Date(`${asOf}T00:00:00Z`);
  if (range === 'YTD') return `${asOf.slice(0, 4)}-01-01`;
  const months = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12, '5Y': 60 }[range];
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

export function isUnavailable(x: PriceHistory | PriceUnavailable): x is PriceUnavailable {
  return 'unavailable' in x;
}
