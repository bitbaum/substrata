/**
 * The listing a company PAGE reads prices, fundamentals and holders for: the
 * join between a site slug and a ticker, for every company in the universe,
 * not only the 29 in the market seed.
 *
 *   1. The market seed by slug (or a directory page it is the listed parent of).
 *   2. The universe entry's identifiers (lib/universe/market-data-seam.ts):
 *      a seed row with the same ticker on the same venue wins, so
 *      `nac-kazatomprom-jsc` (KAP on LSE's IOB) reads the seed's checked row.
 *   3. Otherwise a listing synthesised from those identifiers, on the venues
 *      the price source serves. Nothing about it is checked by hand, so its
 *      market value is not computed (`marketCap` says why) and its currency
 *      is whatever the price source reports.
 *
 * A venue code the price source cannot be told apart on (Bloomberg's "CN" is
 * every Canadian venue; "CH" is Shanghai and Shenzhen) gives no listing, and
 * the page says there is none it can read, rather than guessing a line.
 */
import { participantBySlug } from '@/lib/participants';
import { universeEntries, universeEntry } from '@/lib/universe/store';
import { marketDataKey, type MarketDataKey } from '@/lib/universe/market-data-seam';
import { MARKET_SEED, bySlug, tickerKey, type Exchange, type MarketCompany } from './identity';

/** A venue as a universe row prints it → the exchange the price source reads. */
const VENUES: Record<string, Exchange> = {
  US: 'US',
  NASDAQ: 'NASDAQ',
  NYSE: 'NYSE',
  JP: 'Tokyo',
  JT: 'Tokyo',
  AU: 'ASX',
  GR: 'Xetra',
  GY: 'Xetra',
  FP: 'Euronext Paris',
  NA: 'Euronext Amsterdam',
  LN: 'London',
  LI: 'LSE',
  HK: 'Hong Kong',
  KS: 'Korea',
  KQ: 'Korea',
  TT: 'Taiwan',
  TW: 'Taiwan',
  CT: 'Toronto',
  CN: 'Canada',
  CV: 'TSX Venture',
  SW: 'SIX',
  BZ: 'Sao Paulo',
  SM: 'Madrid',
  SQ: 'Madrid',
  IM: 'Milan',
  SS: 'Stockholm',
  NO: 'Oslo',
  DC: 'Copenhagen',
  FH: 'Helsinki',
  AV: 'Vienna',
  BB: 'Brussels',
  PL: 'Lisbon',
  PW: 'Warsaw',
  SJ: 'Johannesburg',
  SP: 'Singapore',
  TI: 'Tel Aviv',
  IN: 'India',
};

/** Mainland China is one venue code to Bloomberg and two exchanges to Yahoo: the symbol tells which. */
const CHINA_VENUES = new Set(['CH', 'C1', 'C2']);

/** Symbols as the venue writes them: Hong Kong pads to four digits, Korea to six. */
function symbolFor(exchange: Exchange, raw: string): string {
  const s = raw.trim().toUpperCase();
  if (exchange === 'Hong Kong' && /^\d+$/.test(s)) return s.padStart(4, '0');
  if (exchange === 'Korea' && /^\d+$/.test(s)) return s.padStart(6, '0');
  return s;
}

export const UNCHECKED_CAP =
  'this listing comes from the company universe and nobody has checked whether it has several share classes or is a depositary receipt, so its price times the share count is not presented as the market value';

/** The exchange a universe venue code names, or null when the price source cannot tell. */
export function venueExchange(venue: string | undefined, symbol?: string): Exchange | null {
  if (!venue) return null;
  const v = venue.toUpperCase();
  if (CHINA_VENUES.has(v) && symbol && /^\d{6}$/.test(symbol.trim()))
    return /^[69]/.test(symbol) ? 'Shanghai' : /^[03]/.test(symbol) ? 'Shenzhen' : null;
  return VENUES[v] ?? null;
}

/** The listing for a key from the universe, or null with no readable ticker. */
export function listingFromKey(
  slug: string,
  name: string,
  key: MarketDataKey,
): MarketCompany | null {
  const exchange = venueExchange(key.exchange, key.ticker);
  if (!key.ticker || !exchange) return null;
  const symbol = symbolFor(exchange, key.ticker);
  const usLike = (e: Exchange) => e === 'US' || e === 'NASDAQ' || e === 'NYSE';
  const seeded = MARKET_SEED.find(
    (c) =>
      c.ticker.symbol === symbol &&
      (c.ticker.exchange === exchange || (usLike(c.ticker.exchange) && usLike(exchange))),
  );
  if (seeded) return seeded;
  const cik = key.cik && /^\d+$/.test(key.cik) ? Number(key.cik) : undefined;
  return {
    slug,
    name,
    ticker: { exchange, symbol },
    currency: '',
    ...(cik ? { cik } : {}),
    marketCap: UNCHECKED_CAP,
  };
}

/** The listing a company page reads market data for, or null when none is known. */
export function marketCompanyFor(slug: string): MarketCompany | null {
  const seeded = bySlug(slug);
  if (seeded) return seeded;
  const entry = universeEntry(slug);
  if (!entry?.admitted) return null;
  const key = marketDataKey(entry);
  return key ? listingFromKey(slug, entry.name, key) : null;
}

/** For the sections after the price: the listing's absence is explained once, under Share price. */
export const NO_LISTING_SHORT =
  'No figures are read for it: with no known listing there are no filings to read them from (why: under Share price).';

/** Why a page shows no market data for a company: said, never a blank. */
export function noListingReason(slug: string): string {
  const entry = universeEntry(slug);
  if (!entry?.admitted)
    return 'No source read here names an exchange listing for it, so there is no share price, filing-based financial statement or shareholder list to show.';
  if (!entry.ids.ticker)
    return 'Its identifiers in the company universe include no exchange ticker: it may be private, a subsidiary, or listed under a parent.';
  return `Its ticker ${entry.ids.ticker} is printed for venue “${entry.ids.exchange ?? 'unstated'}”, which the price source cannot be told apart on, so no line is read rather than a guessed one.`;
}

let tracked: MarketCompany[] | null = null;

/**
 * Every listing the daily run keeps prices and filings for: the hand-checked
 * seed first, then each admitted universe company whose identifiers resolve to
 * a line the price source serves. One line per ticker.
 */
export function trackedListings(): MarketCompany[] {
  if (tracked) return tracked;
  const seen = new Set<string>();
  const out: MarketCompany[] = [];
  const add = (c: MarketCompany | null) => {
    if (!c || seen.has(tickerKey(c.ticker))) return;
    seen.add(tickerKey(c.ticker));
    out.push(c);
  };
  for (const c of MARKET_SEED) add(c);
  for (const e of universeEntries()) {
    const key = e.admitted ? marketDataKey(e) : null;
    if (key) add(listingFromKey(e.slug, e.name, key));
  }
  tracked = out;
  return out;
}

/** Whether a line is a seed line, checked by hand, or one synthesised from a fund's ticker and venue. */
export const isSeedLine = (c: MarketCompany) => MARKET_SEED.includes(c);

let byLine: Map<string, string> | null = null;

/**
 * The slug of the page a listing's figures belong on: a directory page it is
 * the listed company (or parent) of, else the universe company whose ticker
 * is the same line (`kazatomprom` in the seed is `nac-kazatomprom-jsc` in the
 * universe). Null when no page shows it.
 */
export function pageSlugFor(c: MarketCompany): string | null {
  const own = [c.slug, ...(c.pages ?? [])].find((s) => participantBySlug(s));
  if (own) return own;
  if (universeEntry(c.slug)?.admitted) return c.slug;
  if (!byLine) {
    byLine = new Map();
    for (const e of universeEntries()) {
      if (!e.admitted) continue;
      const key = marketDataKey(e);
      const line = key && listingFromKey(e.slug, e.name, key);
      if (line && !byLine.has(tickerKey(line.ticker))) byLine.set(tickerKey(line.ticker), e.slug);
    }
  }
  return byLine.get(tickerKey(c.ticker)) ?? null;
}
