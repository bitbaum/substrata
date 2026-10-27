/**
 * The front page's market strip: a few listed names under the bottlenecks,
 * each with its last close, its change on the day and a month's line.
 *
 * Shown only when it is cheap and true: the closes are the ones the daily
 * cron already STORED (lib/market-data/prices/store.ts `storedPrices`) — the
 * page never fetches a price source on its own — and every row says which
 * day it is the close of. No stored closes (a fresh deployment, no database,
 * the build): no strip, rather than a strip of guesses. Pure, except
 * `homeMarkets`, which reads the store with a deadline.
 */
import { participantBySlug } from './participants';
import { MARKET_SEED, tickerLabel, type MarketCompany } from './market-data/identity';
import { formatChange, inRange } from './market-data/prices/compute';
import type { PriceHistory } from './market-data/prices/series';
import { storedPrices } from './market-data/prices/store';

/** The names the strip shows, in order: the chain from chips to tools to power. */
export const STRIP_SLUGS = ['nvidia', 'tsmc', 'asml', 'micron', 'ge-vernova', 'cameco'] as const;
/** How long the page waits for the store before drawing no strip. */
export const STRIP_DEADLINE_MS = 2000;

export interface MarketRow {
  name: string;
  /** "NVDA (NASDAQ)". */
  ticker: string;
  /** The company page, when the directory has one. */
  href: string | null;
  close: number;
  currency: string;
  /** Change from the previous close, as a fraction; null with one close only. */
  change: number | null;
  /** "+1.2%", "−0.4%". */
  changeLabel: string;
  /** The day this is the close of, YYYY-MM-DD. */
  asOf: string;
  /** About a month of closes, for the line. */
  spark: number[];
}

/** One stored history → one row, or null when it has nothing to draw. */
export function marketRow(c: MarketCompany, h: PriceHistory): MarketRow | null {
  const points = h.points;
  const last = points.at(-1);
  if (!last) return null;
  const prev = points.at(-2);
  const change = prev && prev.close > 0 ? last.close / prev.close - 1 : null;
  const month = inRange(points, '1M');
  const href = [c.slug, ...(c.pages ?? [])].find((s) => participantBySlug(s));
  return {
    name: c.name,
    ticker: tickerLabel(c.ticker),
    href: href ? `/markets/${href}` : null,
    close: last.close,
    currency: h.currency || c.currency,
    change,
    changeLabel: change === null ? '—' : formatChange(change),
    asOf: last.date,
    spark: (month.length >= 2 ? month : points.slice(-22)).map((p) => p.close),
  };
}

/** An SVG polyline's points for a series in a w×h box. Flat when every value is equal. */
export function sparkPath(values: readonly number[], w = 96, h = 28): string {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = max === min ? h / 2 : h - ((v - min) / span) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/** "1,234.50 USD" — the close as the source gives it, in its currency. */
export function closeLabel(row: Pick<MarketRow, 'close' | 'currency'>): string {
  const n = row.close.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${n} ${row.currency}`;
}

/** The strip's rows from the stored closes, or [] when there are none in time. */
export async function homeMarkets(
  read: (c: MarketCompany) => Promise<PriceHistory | null> = (c) => storedPrices(c.ticker),
  deadlineMs = STRIP_DEADLINE_MS,
): Promise<{ rows: MarketRow[]; source: string | null }> {
  const companies = STRIP_SLUGS.map((s) => MARKET_SEED.find((c) => c.slug === s)).filter(
    (c): c is MarketCompany => Boolean(c),
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const histories = await Promise.race([
    Promise.all(companies.map((c) => read(c).catch(() => null))),
    new Promise<null[]>((resolve) => {
      timer = setTimeout(() => resolve(companies.map(() => null)), deadlineMs);
    }),
  ]).finally(() => timer && clearTimeout(timer));
  const rows = companies
    .map((c, i) => (histories[i] ? marketRow(c, histories[i]) : null))
    .filter((r): r is MarketRow => r !== null);
  const source = histories.find(Boolean)?.source.name ?? null;
  return { rows, source };
}
