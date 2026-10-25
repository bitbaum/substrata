/**
 * SEC EDGAR for the universe, three free reads (SEC's agent string, no key):
 *
 *   company_tickers_exchange.json   CIK ↔ ticker ↔ exchange  → identity
 *   frames/dei/EntityPublicFloat    the float each 10-K cover states → materiality
 *   browse-edgar?SIC=…              filers by their own SIC code → theme
 *
 * Each row's quote is the record as served (a JSON array or object, compact,
 * or the listing row's cells), checked against the fetched text.
 */
import { SIC_THEMES } from '@/config/universe-sources';
import type { SubmittedBy } from '@/lib/entry/candidate';
import type { UniverseRow } from '@/lib/universe/types';
import { htmlRows } from './etf-parse';
import { bodyText, sourceFetch, type FetchDeps } from './http';

export const TICKERS_EXCHANGE = 'https://www.sec.gov/files/company_tickers_exchange.json';
export const floatFrameUrl = (period: string) =>
  `https://data.sec.gov/api/xbrl/frames/dei/EntityPublicFloat/USD/${period}.json`;
export const sicListUrl = (sic: string, start: number) =>
  `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&SIC=${sic}&type=10-K&dateb=&owner=include&start=${start}&count=100`;

/** The float periods read, newest first: every instant a fiscal year can end on. */
export const FLOAT_PERIODS = ['CY2025Q4I', 'CY2025Q3I', 'CY2025Q2I', 'CY2025Q1I'];

const SUBMITTED: SubmittedBy = {
  agent: 'universe-adapter',
  model: 'deterministic-adapter',
  runId: 'universe',
};

export interface EdgarTicker {
  cik: string;
  name: string;
  ticker: string;
  exchange: string;
  quote: string;
}

export interface EdgarFloat {
  cik: string;
  name: string;
  usd: number;
  end: string;
  url: string;
  quote: string;
  fetchedAt: string;
}

export interface SicFiler {
  cik: string;
  name: string;
  sic: string;
  url: string;
  quote: string;
  fetchedAt: string;
}

export async function readTickers(deps: FetchDeps = {}) {
  const got = await sourceFetch(TICKERS_EXCHANGE, 'application/json', deps);
  const text = bodyText(got);
  const data = (JSON.parse(text) as { data: [number, string, string, string | null][] }).data;
  const rows: EdgarTicker[] = data
    .map(([cik, name, ticker, exchange]) => ({
      cik: String(cik),
      name,
      ticker,
      exchange: exchange ?? '',
      quote: JSON.stringify([cik, name, ticker, exchange]),
    }))
    .filter((r) => text.includes(r.quote));
  return { rows, fetchedAt: got.fetchedAt };
}

export async function readFloats(deps: FetchDeps = {}): Promise<Map<string, EdgarFloat>> {
  const byCik = new Map<string, EdgarFloat>();
  for (const period of FLOAT_PERIODS) {
    const url = floatFrameUrl(period);
    let got;
    try {
      got = await sourceFetch(url, 'application/json', deps);
    } catch {
      continue;
    }
    const text = bodyText(got);
    const frame = JSON.parse(text) as {
      data: {
        accn: string;
        cik: number;
        entityName: string;
        loc: string;
        end: string;
        val: number;
      }[];
    };
    for (const r of frame.data) {
      const cik = String(r.cik);
      const quote = JSON.stringify(r);
      const prior = byCik.get(cik);
      if ((prior && prior.end >= r.end) || !text.includes(quote)) continue;
      byCik.set(cik, {
        cik,
        name: r.entityName,
        usd: r.val,
        end: r.end,
        url,
        quote,
        fetchedAt: got.fetchedAt,
      });
    }
  }
  return byCik;
}

export async function readSicFilers(deps: FetchDeps = {}, maxPages = 6): Promise<SicFiler[]> {
  const out: SicFiler[] = [];
  for (const { sic } of SIC_THEMES) {
    for (let page = 0; page < maxPages; page++) {
      const url = sicListUrl(sic, page * 100);
      let got;
      try {
        got = await sourceFetch(url, 'text/html', deps);
      } catch {
        break;
      }
      const rows = htmlRows(bodyText(got)).filter((c) => c.length >= 2 && /^\d{10}$/.test(c[0]));
      for (const c of rows)
        out.push({
          cik: String(Number(c[0])),
          name: c[1],
          sic,
          url,
          quote: c.filter(Boolean).join(' '),
          fetchedAt: got.fetchedAt,
        });
      if (rows.length < 100) break;
    }
  }
  return out;
}

export function floatRow(slug: string, f: EdgarFloat, readOn: string): UniverseRow {
  return {
    company: slug,
    name: f.name,
    family: 'filing',
    evidence: 'candidate',
    asOf: f.end,
    source: { url: f.url, quote: f.quote.slice(0, 400), readOn },
    submittedBy: SUBMITTED,
    provenance: { adapter: 'edgar-universe', fetchedAt: f.fetchedAt, url: f.url },
    establishes: { ids: { cik: f.cik }, size: { basis: 'public-float', usd: f.usd } },
  };
}

export function tickerRow(
  slug: string,
  t: EdgarTicker,
  readOn: string,
  fetchedAt: string,
): UniverseRow {
  return {
    company: slug,
    name: t.name,
    family: 'registry',
    evidence: 'candidate',
    asOf: readOn,
    source: { url: TICKERS_EXCHANGE, quote: t.quote, readOn },
    submittedBy: SUBMITTED,
    provenance: { adapter: 'edgar-universe', fetchedAt, url: TICKERS_EXCHANGE },
    establishes: { ids: { cik: t.cik, ticker: t.ticker, exchange: 'US' } },
  };
}

export function sicRow(slug: string, f: SicFiler, readOn: string): UniverseRow {
  const theme = SIC_THEMES.find((s) => s.sic === f.sic)!;
  return {
    company: slug,
    name: f.name,
    family: 'registry',
    evidence: 'candidate',
    asOf: readOn,
    source: { url: f.url, quote: f.quote, readOn },
    submittedBy: SUBMITTED,
    provenance: { adapter: 'edgar-universe', fetchedAt: f.fetchedAt, url: f.url },
    establishes: {
      theme: theme.theme,
      themeBasis: 'sic',
      themeLabel: `Files with the SEC under SIC ${f.sic} (${theme.label})`,
      ids: { cik: f.cik },
    },
  };
}
