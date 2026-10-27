/**
 * What the company page draws and says about a price history, built in code
 * from the closes (lib/market-data/prices/compute.ts does the arithmetic).
 * Pure: the page renders it, test/company-page.test.ts reads it.
 */
import { money } from '@/lib/market-data/present';
import {
  downsample,
  extremes52w,
  formatChange,
  inRange,
  maxDrawdown,
  sma,
  windowReturn,
} from '@/lib/market-data/prices/compute';
import { RANGES, type PricePoint, type Range } from '@/lib/market-data/prices/series';

export interface Quote {
  close: string;
  date: string;
  /** The day's change against the previous session's close; null on a one-day history. */
  change: { display: string; direction: 'up' | 'down' | 'flat'; from: string } | null;
}

export function quoteOf(points: readonly PricePoint[], currency: string): Quote | null {
  const last = points.at(-1);
  if (!last) return null;
  const prev = points.at(-2);
  const fraction = prev ? last.close / prev.close - 1 : null;
  return {
    close: money(last.close, currency),
    date: last.date,
    change:
      fraction === null || !prev
        ? null
        : {
            display: formatChange(fraction),
            direction: fraction > 0.0005 ? 'up' : fraction < -0.0005 ? 'down' : 'flat',
            from: prev.date,
          },
  };
}

/** One range as the chart and its three figures show it. */
export interface RangeView {
  range: Range;
  /** At most 120 real closes, evenly spaced, first and last kept. */
  points: { x: string; y: number }[];
  /** "+23.4%"; "Not computed" when the history is too short. */
  change: string;
  /** "since 120.15 USD on 2025-10-24", or why there is no figure. */
  changeDetail: string;
  direction: 'up' | 'down' | 'flat' | null;
  /** Highest and lowest close within the range. */
  span: string;
  drawdown: string;
}

export function rangeView(
  points: readonly PricePoint[],
  range: Range,
  currency: string,
): RangeView {
  const within = inRange(points, range);
  const r = windowReturn(points, range);
  const hi = within.reduce<PricePoint | null>((m, p) => (!m || p.close > m.close ? p : m), null);
  const lo = within.reduce<PricePoint | null>((m, p) => (!m || p.close < m.close ? p : m), null);
  const dd = maxDrawdown(within);
  return {
    range,
    points: downsample(within).map((p) => ({ x: p.date, y: p.close })),
    change: r.change === null ? 'Not computed' : r.display,
    changeDetail:
      r.change === null
        ? (r.reason ?? '')
        : `since ${money(r.from!.close, currency)} on ${r.from!.date}`,
    direction: r.change === null ? null : r.change > 0 ? 'up' : r.change < 0 ? 'down' : 'flat',
    span:
      hi && lo
        ? `${money(lo.close, currency)} (${lo.date}) to ${money(hi.close, currency)} (${hi.date})`
        : 'no closes in the range',
    drawdown: dd
      ? `${dd.display}, ${dd.peak.date} to ${dd.trough.date}`
      : 'no fall from a peak in the range',
  };
}

/** Every range, for the client switch: small enough to send whole. */
export function rangeViews(points: readonly PricePoint[], currency: string): RangeView[] {
  return RANGES.map((r) => rangeView(points, r, currency));
}

export interface ReturnRow {
  range: Range;
  display: string;
  direction: 'up' | 'down' | 'flat' | null;
  detail: string;
}

/** The returns table: every range, computed from all closes, with what each compares. */
export function returnsTable(points: readonly PricePoint[], currency: string): ReturnRow[] {
  return RANGES.map((range) => {
    const r = windowReturn(points, range);
    if (r.change === null)
      return { range, display: 'Not computed', direction: null, detail: r.reason ?? '' };
    return {
      range,
      display: r.display,
      direction: r.change > 0 ? 'up' : r.change < 0 ? 'down' : 'flat',
      detail: `${money(r.from!.close, currency)} on ${r.from!.date} → ${money(r.to!.close, currency)} on ${r.to!.date}`,
    };
  });
}

export interface YearRange {
  label: string;
  low: string;
  high: string;
  /** Where the last close sits between them, 0–100, for a meter. */
  position: number;
  note: string;
}

/** The 52-week range of closes, and where the last close sits in it. */
export function yearRange(points: readonly PricePoint[], currency: string): YearRange | null {
  const ext = extremes52w(points);
  const last = points.at(-1);
  if (!ext || !last) return null;
  const width = ext.high.close - ext.low.close;
  return {
    label: '52-week range of closes',
    low: `${money(ext.low.close, currency)} on ${ext.low.date}`,
    high: `${money(ext.high.close, currency)} on ${ext.high.date}`,
    position: width > 0 ? Math.round(((last.close - ext.low.close) / width) * 100) : 50,
    note: 'Highest and lowest daily close of the 52 weeks to the last close; not intraday prices.',
  };
}

/** The 50- and 200-day simple moving averages, as rows of the returns table. */
export function movingAverages(
  points: readonly PricePoint[],
  currency: string,
): { label: string; value: string; detail: string }[] {
  return [50, 200].map((n) => {
    const v = sma(points, n);
    return {
      label: `${n}-day average`,
      value: v === null ? 'Not computed' : money(v, currency),
      detail: v === null ? `fewer than ${n} closes` : `mean of the last ${n} closes`,
    };
  });
}
