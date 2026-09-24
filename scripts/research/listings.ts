/**
 * Build research/listings.json: where each directory company's shares trade.
 *
 *   pnpm run research:listings            # all companies (~25 min: OpenFIGI's
 *                                         # keyless search allows 5 a minute)
 *   pnpm run research:listings -- asml    # one company, for a quick check
 *
 * Two public sources, both recorded on every row so a reader can check it:
 *
 * - the SEC's company_tickers_exchange.json — US listings and the CIK that
 *   EDGAR files them under (which the filings feed needs);
 * - OpenFIGI (Bloomberg's open identifier service) — the primary listing on
 *   the home exchange, as a composite FIGI, e.g. Tokyo Electron = 8035 JP.
 *
 * A name match is only accepted when every word of the company's name appears
 * in the security's name. That misses some real listings, which then read "no
 * listing found"; it does not attach one company's ticker to another. Parents
 * and private companies come from config/substrata-listing-overrides.ts.
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { MARKET_PARTICIPANTS } from '@/lib/participants';
import { LISTING_OVERRIDES } from '@/config/substrata-listing-overrides';
import { HOME_COMPOSITE, type Listing, type ListingsFile, type SecurityRef } from '@/lib/listings';

const OUT = new URL('../../research/listings.json', import.meta.url);
const USER_AGENT = 'Substrata research cato@orangecat.ch';
const SEARCH_GAP_MS = 12_500;

function words(name: string): string[] {
  const stop = new Set([
    'the',
    'and',
    'of',
    'co',
    'corp',
    'corporation',
    'inc',
    'ltd',
    'limited',
    'plc',
    'nv',
    'sa',
    'ag',
    'se',
    'group',
    'holding',
    'holdings',
    'company',
    'kk',
    'spa',
    'asa',
    'ab',
    'oyj',
    'adr',
  ]);
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\/[a-z]+\/?/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(' ')
    .filter((w) => w && !stop.has(w));
}

/** Every word of the wanted name is a word of the candidate's name. */
function sameCompany(wanted: string, candidate: string): boolean {
  const have = new Set(words(candidate));
  const want = words(wanted);
  return want.length > 0 && want.every((w) => have.has(w));
}

type SecRow = [number, string, string, string];

async function secTable(): Promise<SecRow[]> {
  const response = await fetch('https://www.sec.gov/files/company_tickers_exchange.json', {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!response.ok) throw new Error(`SEC tickers: ${response.status}`);
  return ((await response.json()) as { data: SecRow[] }).data;
}

function secMatch(table: SecRow[], query: string): SecurityRef | null {
  const hits = table.filter(
    ([, name]) => sameCompany(query, name) && words(name).length <= words(query).length + 2,
  );
  // A primary exchange over OTC, and the plainest share class over the rest.
  const best = hits.find((h) => h[3] !== 'OTC') ?? hits[0];
  if (!best) return null;
  const [cik, name, ticker, exchange] = best;
  return {
    ticker,
    exchange,
    name,
    cik,
    source: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}`,
  };
}

interface FigiRow {
  name: string;
  ticker: string;
  exchCode: string;
  figi: string;
  compositeFIGI: string;
}

let lastSearch = 0;

/** One OpenFIGI search, spaced to its keyless limit and patient with a 429. */
async function figiSearch(query: string, exchCode: string): Promise<FigiRow[]> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const wait = lastSearch + SEARCH_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastSearch = Date.now();
    const response = await fetch('https://api.openfigi.com/v3/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        exchCode,
        marketSecDes: 'Equity',
        securityType2: 'Common Stock',
      }),
    });
    if (response.status === 429) {
      await new Promise((r) => setTimeout(r, 60_000));
      continue;
    }
    if (!response.ok) throw new Error(`OpenFIGI ${response.status}`);
    return ((await response.json()) as { data?: FigiRow[] }).data ?? [];
  }
  throw new Error('OpenFIGI kept refusing');
}

/**
 * The primary listing: the composite line on a home exchange, searched one
 * home exchange at a time. Never another country's line: ASML's first page of
 * results had its Swiss line and not its Amsterdam one, and "ASML SW" is not
 * where ASML trades.
 */
async function figiPrimary(query: string, jurisdictions: string[]): Promise<SecurityRef | null> {
  const homes = [...new Set(jurisdictions.map((j) => HOME_COMPOSITE[j]).filter(Boolean))];
  for (const exchCode of homes) {
    const rows = await figiSearch(query, exchCode);
    const lines = rows.filter((r) => r.exchCode === exchCode && sameCompany(query, r.name));
    // The composite where the exchange has one; Euronext Amsterdam's ASML line
    // is not flagged composite and is still the line that trades.
    const best = lines.find((r) => r.figi === r.compositeFIGI) ?? lines[0];
    if (best)
      return {
        ticker: best.ticker,
        exchange: best.exchCode,
        name: best.name,
        figi: best.figi,
        source: `https://www.openfigi.com/id/${best.figi}`,
      };
  }
  return null;
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const previous: ListingsFile = (() => {
    try {
      return JSON.parse(readFileSync(OUT, 'utf8')) as ListingsFile;
    } catch {
      return { version: 1, checkedOn: '', listings: {} };
    }
  })();
  const sec = await secTable();
  const today = new Date().toISOString().slice(0, 10);
  const listings: Record<string, Listing> = { ...previous.listings };
  const todo = MARKET_PARTICIPANTS.filter((p) => only.length === 0 || only.includes(p.slug));

  for (const [i, p] of todo.entries()) {
    const override = LISTING_OVERRIDES[p.slug];
    if (override && 'private' in override) {
      listings[p.slug] = { status: 'private', note: override.private, checkedOn: today };
      console.log(`${p.slug}: private`);
      continue;
    }
    const query = override && 'query' in override ? override.query : p.name;
    const us = secMatch(sec, query);
    let primary: SecurityRef | null = null;
    try {
      primary = await figiPrimary(query, p.jurisdictions);
    } catch (error) {
      console.error(`${p.slug}: OpenFIGI failed (${(error as Error).message}); keeping SEC only`);
    }
    // A US-only company has its SEC listing as its primary.
    if (!primary && us && us.exchange !== 'OTC') primary = { ...us };
    const parent = override && 'parent' in override ? override : null;
    listings[p.slug] =
      primary || us
        ? {
            status: parent ? 'parent' : 'listed',
            ...(parent ? { parent: parent.parent, note: parent.note } : {}),
            primary,
            us,
            checkedOn: today,
          }
        : { status: 'none-found', query, checkedOn: today };
    const l = listings[p.slug];
    console.log(
      `[${i + 1}/${todo.length}] ${p.slug}: ${l.status}` +
        ('primary' in l && l.primary ? ` ${l.primary.ticker} ${l.primary.exchange}` : '') +
        ('us' in l && l.us ? ` · US ${l.us.ticker} ${l.us.exchange} CIK ${l.us.cik}` : ''),
    );
    writeFileSync(OUT, `${JSON.stringify({ version: 1, checkedOn: today, listings }, null, 2)}\n`);
  }
  writeFileSync(OUT, `${JSON.stringify({ version: 1, checkedOn: today, listings }, null, 2)}\n`);
}

void main();
