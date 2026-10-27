/**
 * Every number said about a price history is computed here, in code — never
 * by a model. The Ask is told to copy these strings and the grounding checks
 * reject a figure no tool returned, so "up 23% over the year" can only be a
 * figure this file produced from stored closes.
 *
 * Conventions, stated once:
 *   - A return over a window compares the newest close with the last close ON
 *     OR BEFORE the window's first day (the close a holder would have had).
 *     When the history does not reach back that far the return is null, with
 *     the reason — a 5-year return of a stock listed two years ago is not
 *     its "since listing" return under another name.
 *   - YTD's base is the last close of the previous calendar year.
 *   - 52-week high/low are of daily CLOSES, not intraday highs and lows.
 *   - Max drawdown is the largest peak-to-trough fall of the closes in the
 *     range, with the two dates.
 */
import { RANGES, rangeStart, type PricePoint, type Range } from './series';

export interface WindowReturn {
  range: Range;
  /** Fraction: 0.234 is +23.4%. Null when the history is too short. */
  change: number | null;
  /** "+23.4%", "−8.1%" — the form to copy. */
  display: string;
  from?: PricePoint;
  to?: PricePoint;
  reason?: string;
}

export interface Extreme {
  close: number;
  date: string;
}

export interface Drawdown {
  /** Fraction, ≤ 0: −0.37 is a 37% fall. */
  change: number;
  display: string;
  peak: PricePoint;
  trough: PricePoint;
}

export interface PriceStats {
  last: PricePoint;
  returns: WindowReturn[];
  high52w: Extreme | null;
  low52w: Extreme | null;
  /** Over the range asked for. */
  maxDrawdown: Drawdown | null;
  sma50: number | null;
  sma200: number | null;
}

/** "+23.4%" / "−8.1%" / "0.0%". The minus is a real minus sign. */
export function formatChange(fraction: number): string {
  const pct = Math.round(fraction * 1000) / 10;
  if (pct === 0) return '0.0%';
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%`;
}

/** The last point on or before `day`, by binary search (points are sorted ascending). */
export function closeOnOrBefore(
  points: readonly PricePoint[],
  day: string,
): PricePoint | undefined {
  let lo = 0;
  let hi = points.length - 1;
  let found: PricePoint | undefined;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].date <= day) {
      found = points[mid];
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

const dayBefore = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

const GRACE_DAYS = 7;
const daysBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;

export function windowReturn(points: readonly PricePoint[], range: Range): WindowReturn {
  const to = points.at(-1);
  if (!to) return { range, change: null, display: 'no data', reason: 'no closes stored' };
  const start = rangeStart(range, to.date);
  // YTD: the base is the last close of last year; otherwise the last close on or before the start.
  // A history that starts within a week of the window's first day (the source's
  // "5y" ends a few sessions short of five calendar years) starts the window;
  // the `from` date travels with the figure, so the window is never misstated.
  const first = points[0];
  const from =
    closeOnOrBefore(points, range === 'YTD' ? dayBefore(start) : start) ??
    (range !== 'YTD' && daysBetween(start, first.date) <= GRACE_DAYS ? first : undefined);
  if (!from || from.date === to.date)
    return {
      range,
      change: null,
      display: 'not enough history',
      reason: `the history starts on ${points[0].date}, after ${start}`,
    };
  const change = to.close / from.close - 1;
  return { range, change, display: formatChange(change), from, to };
}

/** Highest and lowest close in the 52 weeks to the newest close. */
export function extremes52w(points: readonly PricePoint[]): { high: Extreme; low: Extreme } | null {
  const last = points.at(-1);
  if (!last) return null;
  const since = rangeStart('1Y', last.date);
  const year = points.filter((p) => p.date > since);
  let high = year[0];
  let low = year[0];
  for (const p of year) {
    if (p.close > high.close) high = p;
    if (p.close < low.close) low = p;
  }
  return {
    high: { close: high.close, date: high.date },
    low: { close: low.close, date: low.date },
  };
}

export function maxDrawdown(points: readonly PricePoint[]): Drawdown | null {
  if (points.length < 2) return null;
  let peak = points[0];
  let worst: Drawdown | null = null;
  for (const p of points) {
    if (p.close > peak.close) peak = p;
    const change = p.close / peak.close - 1;
    if (!worst || change < worst.change)
      worst = { change, display: formatChange(change), peak, trough: p };
  }
  return worst && worst.change < 0 ? worst : null;
}

/** Simple moving average of the last `n` closes; null with fewer than `n`. */
export function sma(points: readonly PricePoint[], n: number): number | null {
  if (points.length < n || n <= 0) return null;
  const tail = points.slice(-n);
  return Math.round((tail.reduce((s, p) => s + p.close, 0) / n) * 100) / 100;
}

/** Simple moving average at every point from the n-th on, for a chart overlay. */
export function smaSeries(points: readonly PricePoint[], n: number): PricePoint[] {
  const out: PricePoint[] = [];
  let sum = 0;
  points.forEach((p, i) => {
    sum += p.close;
    if (i >= n) sum -= points[i - n].close;
    if (i >= n - 1) out.push({ date: p.date, close: Math.round((sum / n) * 100) / 100 });
  });
  return out;
}

/** The closes from a range's first day on. */
export function inRange(points: readonly PricePoint[], range: Range): PricePoint[] {
  const last = points.at(-1);
  if (!last) return [];
  const start = rangeStart(range, last.date);
  return points.filter((p) => p.date >= start);
}

/**
 * At most `max` points, evenly spaced, always keeping the first and the last:
 * a chart block holds 120 points (chatkit), and a year has ~252 sessions.
 * Each kept point is a real close on its real day — nothing is averaged.
 */
export function downsample(points: readonly PricePoint[], max = 120): PricePoint[] {
  if (points.length <= max) return [...points];
  const step = (points.length - 1) / (max - 1);
  const out: PricePoint[] = [];
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]);
  return out;
}

/** Everything the page and the Ask say about one history, for the range asked. */
export function priceStats(points: readonly PricePoint[], range: Range): PriceStats | null {
  const last = points.at(-1);
  if (!last) return null;
  const ext = extremes52w(points);
  return {
    last,
    returns: RANGES.map((r) => windowReturn(points, r)),
    high52w: ext?.high ?? null,
    low52w: ext?.low ?? null,
    maxDrawdown: maxDrawdown(inRange(points, range)),
    sma50: sma(points, 50),
    sma200: sma(points, 200),
  };
}
