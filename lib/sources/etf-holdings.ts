/**
 * Thematic fund holdings → universe evidence rows. One holding row from an
 * issuer's own file establishes three things at once, each quoted from that
 * line: theme interest (the fund's theme), identity (ticker and venue, CUSIP
 * or SEDOL) and, where the file prints a market value, the position size
 * (the `fund-position` floor). It never establishes a role in a chain.
 *
 * Global X names each day's file by date; the adapter walks back from today
 * to the newest one published. A file older than the freshness window still
 * reads, and admit() sets its rows aside with the reason.
 */
import type { Fund } from '@/config/universe-sources';
import type { SubmittedBy } from '@/lib/entry/candidate';
import type { UniverseRow } from '@/lib/universe/types';
import { parseHoldings, type Holding } from './etf-parse';
import { sourceFetch, type FetchDeps } from './http';

export interface FundRead {
  fund: Fund;
  url: string;
  asOf: string | null;
  fetchedAt: string;
  holdings: Holding[];
  /** What went wrong, when nothing was read. */
  error?: string;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

/** The URLs to try for a fund, newest first: one for a fixed file, a week of days for a dated one. */
export function fundUrls(fund: Fund, today: string): string[] {
  if (!fund.url.includes('{date}')) return [fund.url];
  const day = new Date(`${today}T12:00:00Z`);
  return Array.from({ length: 8 }, (_, i) =>
    fund.url.replace('{date}', ymd(new Date(day.getTime() - i * 86_400_000))),
  );
}

export async function readFund(fund: Fund, today: string, deps: FetchDeps = {}): Promise<FundRead> {
  let last = 'not read';
  for (const url of fundUrls(fund, today)) {
    try {
      const got = await sourceFetch(url, '*/*', deps);
      const parsed = parseHoldings(fund.format, got.body);
      if (!parsed.holdings.length) {
        last = `${url}: no holdings rows found in the file`;
        continue;
      }
      return { fund, url, asOf: parsed.asOf, fetchedAt: got.fetchedAt, holdings: parsed.holdings };
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
  }
  return {
    fund,
    url: fundUrls(fund, today)[0],
    asOf: null,
    fetchedAt: '',
    holdings: [],
    error: last,
  };
}

/** A US CUSIP to its ISIN (US + CUSIP + Luhn check digit over the letters-as-numbers string). */
export function isinOfCusip(cusip: string | undefined): string | undefined {
  if (!cusip || !/^[0-9]{3}[0-9A-Z]{5}[0-9]$/.test(cusip)) return undefined;
  const body = `US${cusip}`;
  const digits = [...body]
    .map((ch) => (/\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55)))
    .join('');
  let sum = 0;
  [...digits].reverse().forEach((d, i) => {
    let n = Number(d);
    if (i % 2 === 0) n *= 2;
    sum += n > 9 ? n - 9 : n;
  });
  return `${body}${(10 - (sum % 10)) % 10}`;
}

const SUBMITTED: SubmittedBy = {
  agent: 'universe-adapter',
  model: 'deterministic-adapter',
  runId: 'universe',
};

/** One evidence row per holding. `slugFor` is the caller's identity resolution. */
export function fundRows(
  read: FundRead,
  slugFor: (h: Holding) => string,
  readOn: string,
  submittedBy: SubmittedBy = SUBMITTED,
): UniverseRow[] {
  if (!read.asOf) return [];
  return read.holdings
    .filter((h) => h.quote.length >= 20)
    .map((h) => {
      const isin = h.exchange === 'US' ? isinOfCusip(h.cusip) : undefined;
      return {
        company: slugFor(h),
        name: h.name,
        ...(h.exchange === 'US' ? { country: 'US' } : {}),
        family: 'fund' as const,
        evidence: 'candidate' as const,
        asOf: read.asOf!,
        source: { url: read.url, quote: h.quote.slice(0, 400), readOn, locator: h.locator },
        submittedBy,
        provenance: { adapter: 'etf-holdings', fetchedAt: read.fetchedAt, url: read.url },
        establishes: {
          theme: read.fund.theme,
          themeBasis: 'fund' as const,
          themeLabel: `Held by ${read.fund.name} (${read.fund.ticker}, ${read.fund.issuer})`,
          ids: {
            ticker: h.ticker,
            exchange: h.exchange,
            ...(h.cusip ? { cusip: h.cusip } : {}),
            ...(h.sedol ? { sedol: h.sedol } : {}),
            ...(isin ? { isin } : {}),
          },
          ...(h.marketValueUsd !== undefined
            ? { size: { basis: 'fund-position' as const, usd: Math.round(h.marketValueUsd) } }
            : {}),
        },
      };
    });
}
