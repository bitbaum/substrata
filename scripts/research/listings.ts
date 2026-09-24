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
import {
  choosePrimary,
  isPinned,
  pinnedLine,
  sameCompany,
  type FigiMapped,
} from '@/lib/listing-match';
import { LISTING_OVERRIDES, type PinnedLine } from '@/config/substrata-listing-overrides';
import { HOME_COMPOSITE, type Listing, type ListingsFile, type SecurityRef } from '@/lib/listings';

const OUT = new URL('../../research/listings.json', import.meta.url);
const USER_AGENT = 'Substrata research cato@orangecat.ch';
const SEARCH_GAP_MS = 12_500;

type SecRow = [number, string, string, string];

async function secTable(): Promise<SecRow[]> {
  const response = await fetch('https://www.sec.gov/files/company_tickers_exchange.json', {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!response.ok) throw new Error(`SEC tickers: ${response.status}`);
  return ((await response.json()) as { data: SecRow[] }).data;
}

function secMatch(table: SecRow[], query: string): SecurityRef | null {
  const hits = table.filter(([, name]) => sameCompany(query, name));
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
 * The line on each home exchange, searched one exchange at a time. Never
 * another country's line: ASML's first page of unfiltered results had its
 * Swiss line and not its Amsterdam one, and "ASML SW" is not where it trades.
 */
async function figiHomeLines(query: string, jurisdictions: string[]): Promise<SecurityRef[]> {
  const homes = [...new Set(jurisdictions.map((j) => HOME_COMPOSITE[j]).filter(Boolean))];
  const found: SecurityRef[] = [];
  for (const exchCode of homes) {
    if (exchCode === 'US') continue; // the SEC file is the source for US lines
    const rows = await figiSearch(query, exchCode);
    const lines = rows.filter((r) => r.exchCode === exchCode && sameCompany(query, r.name));
    // The composite where the exchange has one; Euronext Amsterdam's ASML line
    // is not flagged composite and is still the line that trades.
    const best = lines.find((r) => r.figi === r.compositeFIGI) ?? lines[0];
    if (best)
      found.push({
        ticker: best.ticker,
        exchange: best.exchCode,
        name: best.name,
        figi: best.figi,
        source: `https://www.openfigi.com/id/${best.figi}`,
      });
  }
  return found;
}

/**
 * A pinned home line, looked up by identifier rather than by name: OpenFIGI's
 * mapping of ticker + exchange, accepted only if the name is still the one a
 * person checked (see `pinnedLine`).
 */
async function figiPinned(pin: PinnedLine): Promise<SecurityRef | null> {
  const wait = lastSearch + SEARCH_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastSearch = Date.now();
  const response = await fetch('https://api.openfigi.com/v3/mapping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([
      { idType: 'TICKER', idValue: pin.ticker, exchCode: pin.exchange, marketSecDes: 'Equity' },
    ]),
  });
  if (!response.ok) throw new Error(`OpenFIGI mapping ${response.status}`);
  const [job] = (await response.json()) as Array<{ data?: FigiMapped[] }>;
  return pinnedLine(job?.data ?? [], pin);
}

/**
 * Re-apply the matching rule to what is already stored, without searching
 * again: a rule change must be able to retract a ticker it would no longer
 * accept.
 */
function revalidate(
  listing: Listing,
  query: string,
  jurisdictions: string[],
  sec: SecRow[],
  pin?: PinnedLine,
): Listing {
  if (listing.status !== 'listed' && listing.status !== 'parent') return listing;
  const homes =
    listing.primary?.figi && sameCompany(query, listing.primary.name) ? [listing.primary] : [];
  const us = secMatch(sec, query);
  const primary = isPinned(listing.primary, pin)
    ? listing.primary
    : choosePrimary(homes, us, jurisdictions);
  if (!primary && !us) return { status: 'none-found', query, checkedOn: listing.checkedOn };
  return { ...listing, primary, us };
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const mode = process.argv.includes('--revalidate')
    ? 'revalidate'
    : process.argv.includes('--missing')
      ? 'missing'
      : 'all';
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
    if (override && 'private' in override && mode !== 'revalidate') {
      listings[p.slug] = { status: 'private', note: override.private, checkedOn: today };
      console.log(`${p.slug}: private`);
      continue;
    }
    const query = (override && 'query' in override && override.query) || p.name;
    const pin = override && 'home' in override ? override.home : undefined;
    const jurisdictions =
      override && 'jurisdictions' in override && override.jurisdictions
        ? override.jurisdictions
        : p.jurisdictions;
    if (mode === 'revalidate') {
      if (listings[p.slug])
        listings[p.slug] = revalidate(listings[p.slug], query, jurisdictions, sec, pin);
      continue;
    }
    if (mode === 'missing' && listings[p.slug]) continue;
    const us = secMatch(sec, query);
    let homeLines: SecurityRef[] = [];
    try {
      homeLines = await figiHomeLines(query, jurisdictions);
    } catch (error) {
      console.error(`${p.slug}: OpenFIGI failed (${(error as Error).message}); keeping SEC only`);
    }
    let pinned: SecurityRef | null = null;
    if (pin) {
      try {
        pinned = await figiPinned(pin);
      } catch (error) {
        console.error(`${p.slug}: OpenFIGI mapping failed (${(error as Error).message})`);
      }
      if (!pinned)
        console.error(
          `${p.slug}: pinned ${pin.ticker} ${pin.exchange} "${pin.figiName}" no longer matches — review the pin`,
        );
    }
    // A pinned line is the home line: a person checked it, and it was taken
    // only because OpenFIGI still returns that exact ticker and name.
    const primary = pinned ?? choosePrimary(homeLines, us, jurisdictions);
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
