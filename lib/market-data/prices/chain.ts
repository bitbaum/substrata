/**
 * Where daily share prices come from, and what happens when they do not come.
 *
 * THE CHOICE (tested from the build sandbox, 2026-10-25)
 *
 *   Yahoo Finance chart endpoint — CHOSEN. No key; every one of the 28 seed
 *     listings (US, Amsterdam, Paris, Xetra, Tokyo, ASX, London IOB) returned
 *     five years of daily closes, split-adjusted, agreeing to the cent with
 *     Nasdaq's own history for the US names. Answers our honest agent string.
 *   Stooq CSV (stooq.com/q/d/l/?s=nvda.us&i=d) — REJECTED: answers a
 *     JavaScript browser challenge (and resets the connection) instead of the
 *     CSV; nothing a server can read without pretending to be a browser.
 *   Nasdaq (api.nasdaq.com/api/quote/<sym>/historical) — REJECTED: serves the
 *     same five years for US listings, but only to a browser user agent; with
 *     ours it answers 503. We do not spoof agents. US listings only, too.
 *   Alpha Vantage (BYOK) — NOT WIRED: the free key allows 25 calls a day, the
 *     full daily history is a premium feature, and its free daily closes are
 *     NOT split-adjusted, so a series from it could not sit beside these.
 *     A reader-key adapter can be added to `ADAPTERS` the day one is worth it.
 *   Tiingo, FMP, EODHD, Marketstack — key required (403/401 without one).
 *
 * LICENCE POSITION, said plainly: no free source found grants a licence to
 * redistribute exchange prices. Yahoo's terms allow personal, non-commercial
 * use. Substrata therefore stores end-of-day closes to draw charts and compute
 * returns, names "Yahoo Finance" with a link beside every figure, labels them
 * delayed end-of-day, and does NOT put them in the public research export or
 * any download. If Yahoo objects or the endpoint closes, prices go dark with
 * the reason shown; nothing is substituted silently.
 *
 * FAILURE MODES: a 429 is waited out by sourceFetch; query1 refusing tries
 * query2 (the same service on another edge); both failing leaves the stored
 * closes in place (the cron records the failure for /data/freshness) and a
 * reader asking with nothing stored gets `PriceUnavailable` with the reason.
 * Yahoo has changed this endpoint before (cookie "crumbs" on the CSV download
 * in 2017); the chart JSON has stayed keyless, but that is a fact about
 * today, not a promise.
 */
import { bodyText, sourceFetch, type FetchDeps } from '@/lib/sources/http';
import type { Ticker } from '../identity';
import { hasAltSymbol, parseYahooChart, yahooChartUrl, yahooQuotePage } from './yahoo';
import { lineNameAgrees, lineNameMismatch } from './line-name';
import type { PricePoint, PriceSource } from './series';

export interface FetchedPrices {
  points: PricePoint[];
  currency: string | null;
  source: PriceSource;
  fetchedAt: string;
}

export interface PriceAdapter {
  /** The `source` column a stored row carries. */
  id: string;
  /** `expectName`: the company the symbol should be (unchecked listings only). */
  fetch: (t: Ticker, deps: FetchDeps, expectName?: string) => Promise<FetchedPrices>;
}

export const YAHOO_TERMS =
  'Yahoo Finance, read through its public chart endpoint under its personal-use terms; delayed end-of-day closes, not redistributed.';

function yahooFrom(host: 'query1' | 'query2'): PriceAdapter {
  return {
    id: 'yahoo',
    async fetch(t, deps, expectName) {
      let last: Error | null = null;
      for (const alt of hasAltSymbol(t) ? [false, true] : [false]) {
        try {
          const fetched = await sourceFetch(yahooChartUrl(t, host, alt), 'application/json', deps);
          const parsed = parseYahooChart(bodyText(fetched));
          if (!parsed.points.length) throw new Error(`Yahoo returned no closes for ${t.symbol}`);
          if (expectName && !lineNameAgrees(expectName, parsed.names))
            throw new Error(lineNameMismatch(expectName, parsed.names));
          return {
            points: parsed.points,
            currency: parsed.currency,
            source: { name: 'Yahoo Finance', url: yahooQuotePage(t), terms: YAHOO_TERMS },
            fetchedAt: fetched.fetchedAt,
          };
        } catch (error) {
          last = error instanceof Error ? error : new Error('failed');
        }
      }
      throw last ?? new Error('failed');
    },
  };
}

/** Tried in order; the first that answers wins. */
export const ADAPTERS: readonly PriceAdapter[] = [yahooFrom('query1'), yahooFrom('query2')];

export const SOURCE_NAMES: Record<string, PriceSource> = {
  yahoo: { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/', terms: YAHOO_TERMS },
};

/** Daily closes for one listing through the chain, or the reasons every adapter gave. */
export async function fetchPrices(
  t: Ticker,
  deps: FetchDeps = {},
  adapters: readonly PriceAdapter[] = ADAPTERS,
  expectName?: string,
): Promise<(FetchedPrices & { adapter: string }) | { failed: string[] }> {
  const failed: string[] = [];
  // Server reads never write the source cache to disk unless a script asks.
  const d: FetchDeps = { cacheDir: null, ...deps };
  for (const a of adapters) {
    try {
      return { ...(await a.fetch(t, d, expectName)), adapter: a.id };
    } catch (error) {
      failed.push(`${a.id}: ${error instanceof Error ? error.message : 'failed'}`);
    }
  }
  return { failed };
}
