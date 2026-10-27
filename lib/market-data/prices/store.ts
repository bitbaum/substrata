/**
 * Daily closes in Postgres (scripts/db/016-market-data.sql), and the one
 * reader every surface uses: `priceHistory(ticker, range)`.
 *
 * The cron (/api/cron/prices) fetches each seed listing once a day through
 * the chain and upserts. A reader gets the stored closes; when nothing is
 * stored for that listing yet (the migration not applied, a ticker added
 * today) it reads the chain live, so the Ask works on a fresh deployment
 * too. Either way the result says which (`via`).
 */
import { database } from '@/lib/db';
import type { FetchDeps } from '@/lib/sources/http';
import { trackedListings, isSeedLine } from '../company';
import { byTicker, tickerKey, type Ticker } from '../identity';
import { SOURCE_NAMES, fetchPrices } from './chain';
import { BASIS, DELAY, type PriceHistory, type PricePoint, type PriceUnavailable } from './series';

export interface PriceRun {
  tickers: number;
  pointsNew: number;
  pointsRevised: number;
  failed: number;
  errors: string[];
}

/** Upsert one listing's closes; counts new and revised rows. */
export async function storePrices(
  t: Ticker,
  source: string,
  currency: string,
  points: readonly PricePoint[],
): Promise<{ added: number; revised: number }> {
  if (!points.length) return { added: 0, revised: 0 };
  // One statement per listing: unnest the arrays, compare, report.
  const result = await database().query<{ inserted: boolean }>(
    `INSERT INTO research_price_points (exchange, symbol, source, day, close, currency)
     SELECT $1, $2, $3, d::date, c, $4 FROM unnest($5::text[], $6::float8[]) AS u(d, c)
     ON CONFLICT (exchange, symbol, source, day) DO UPDATE
       SET close = EXCLUDED.close, currency = EXCLUDED.currency, updated_at = now()
       WHERE research_price_points.close <> EXCLUDED.close
          OR research_price_points.currency <> EXCLUDED.currency
     RETURNING (xmax = 0) AS inserted`,
    [t.exchange, t.symbol, source, currency, points.map((p) => p.date), points.map((p) => p.close)],
  );
  const added = result.rows.filter((r) => r.inserted).length;
  return { added, revised: result.rows.length - added };
}

/** Newest stored close per line: the run reads the stalest first, so every line comes round. */
async function latestDays(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const r = await database().query<{ exchange: string; symbol: string; day: string }>(
      `SELECT exchange, symbol, to_char(max(day), 'YYYY-MM-DD') AS day
         FROM research_price_points GROUP BY exchange, symbol`,
    );
    for (const row of r.rows) out.set(`${row.exchange}:${row.symbol}`, row.day);
  } catch {
    // No table yet: every line is "never read" and the run starts from the seed.
  }
  return out;
}

/**
 * The daily run: the seed listings first, every day, then the rest of the
 * tracked universe lines stalest first until the deadline, one run row. A line
 * that is not a seed line is stored only if the source's name for the symbol
 * agrees with the company's (./line-name.ts).
 */
export async function fetchAllPrices(
  deps: FetchDeps = {},
  opts: { deadline?: number } = {},
): Promise<PriceRun> {
  const db = database();
  const latest = await latestDays();
  const run = await db.query<{ id: string }>(
    'INSERT INTO research_price_runs DEFAULT VALUES RETURNING id',
  );
  const out: PriceRun = { tickers: 0, pointsNew: 0, pointsRevised: 0, failed: 0, errors: [] };
  const lines = trackedListings();
  const order = [
    ...lines.filter(isSeedLine),
    ...lines
      .filter((c) => !isSeedLine(c))
      .sort((a, b) =>
        (latest.get(tickerKey(a.ticker)) ?? '').localeCompare(
          latest.get(tickerKey(b.ticker)) ?? '',
        ),
      ),
  ];
  for (const c of order) {
    if (opts.deadline && Date.now() > opts.deadline) break;
    const got = await fetchPrices(c.ticker, deps, undefined, isSeedLine(c) ? undefined : c.name);
    if ('failed' in got) {
      out.failed += 1;
      out.errors.push(`${tickerKey(c.ticker)}: ${got.failed.join('; ')}`);
      continue;
    }
    try {
      const n = await storePrices(c.ticker, got.adapter, got.currency ?? c.currency, got.points);
      out.tickers += 1;
      out.pointsNew += n.added;
      out.pointsRevised += n.revised;
    } catch (error) {
      out.failed += 1;
      out.errors.push(
        `${tickerKey(c.ticker)}: ${error instanceof Error ? error.message : 'store failed'}`,
      );
    }
  }
  await db.query(
    `UPDATE research_price_runs SET finished_at = now(), tickers = $2, points_new = $3,
       points_revised = $4, failed = $5 WHERE id = $1`,
    [run.rows[0].id, out.tickers, out.pointsNew, out.pointsRevised, out.failed],
  );
  return out;
}

/** Stored closes for a listing, newest source first; null when nothing is stored or no database. */
export async function storedPrices(t: Ticker): Promise<PriceHistory | null> {
  let rows: { day: string; close: number; currency: string; source: string; updated_at: Date }[];
  try {
    const result = await database().query<{
      day: string;
      close: number;
      currency: string;
      source: string;
      updated_at: Date;
    }>(
      `SELECT to_char(day, 'YYYY-MM-DD') AS day, close, currency, source, updated_at
         FROM research_price_points
        WHERE exchange = $1 AND symbol = $2
          AND source = (SELECT source FROM research_price_points WHERE exchange = $1 AND symbol = $2
                         ORDER BY day DESC LIMIT 1)
        ORDER BY day`,
      [t.exchange, t.symbol],
    );
    rows = result.rows;
  } catch {
    return null;
  }
  if (!rows.length) return null;
  const last = rows.at(-1)!;
  const company = byTicker(t);
  const named = SOURCE_NAMES[last.source] ?? { name: last.source, url: '', terms: '' };
  return {
    ticker: t,
    currency: last.currency || company?.currency || '',
    points: rows.map((r) => ({ date: r.day, close: Number(r.close) })),
    source: named,
    asOf: last.day,
    fetchedAt: rows
      .reduce((m, r) => (r.updated_at > m ? r.updated_at : m), rows[0].updated_at)
      .toISOString(),
    basis: BASIS,
    delay: DELAY,
    via: 'stored',
  };
}

const LIVE_TTL_MS = 6 * 60 * 60 * 1000;
const FAILED_TTL_MS = 10 * 60 * 1000;
const live = new Map<string, { at: number; value: PriceHistory | PriceUnavailable }>();

/**
 * Stored closes, else a live read through the chain (cached six hours in
 * this process). Never throws: no data is a `PriceUnavailable` with why.
 */
export async function priceHistory(
  t: Ticker,
  deps: FetchDeps & {
    stored?: (t: Ticker) => Promise<PriceHistory | null>;
    now?: () => number;
    /** The company the symbol should be, for a line nobody checked by hand. */
    expectName?: string;
  } = {},
): Promise<PriceHistory | PriceUnavailable> {
  const stored = await (deps.stored ?? storedPrices)(t);
  if (stored) return stored;
  const now = (deps.now ?? Date.now)();
  const key = tickerKey(t);
  const hit = live.get(key);
  const ttl = hit && 'unavailable' in hit.value ? FAILED_TTL_MS : LIVE_TTL_MS;
  if (hit && now - hit.at < ttl) return hit.value;
  const got = await fetchPrices(t, deps, undefined, deps.expectName);
  const value: PriceHistory | PriceUnavailable =
    'failed' in got
      ? {
          unavailable: true,
          ticker: t,
          reason: `The price source could not be read just now (${got.failed.join('; ')}).`,
        }
      : {
          ticker: t,
          currency: got.currency ?? byTicker(t)?.currency ?? '',
          points: got.points,
          source: got.source,
          asOf: got.points.at(-1)!.date,
          fetchedAt: got.fetchedAt,
          basis: BASIS,
          delay: DELAY,
          via: 'live',
        };
  live.set(key, { at: now, value });
  return value;
}

/** Forget the live cache (tests). */
export function resetLivePrices(): void {
  live.clear();
}
