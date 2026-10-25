/**
 * Which security a market figure is about: `{exchange, symbol}`, plus the SEC
 * registrant id (`cik`) where the company files with the SEC.
 *
 * THE SEAM. The company universe (identity registry, tiers, themes) is being
 * built in lib/universe and the entity registry; this module does not touch
 * either. Market data is keyed by TICKER here and nowhere else, and the join
 * to a site company is the small committed seed below: company slug →
 * listing (and CIK). When the universe lands, it replaces `MARKET_SEED` with
 * its own `company:<slug>` → ticker rows and every reader keeps working,
 * because they only ever call `byTicker`, `byCik`, `bySlug` and
 * `marketCompaniesIn`.
 *
 * One listing per company: the line prices are read for. Where a company
 * also trades at home (TSMC 2330 TW, ASML on Euronext) the seed says so in
 * `home`; the figure a reader sees always names the line it is of, so a
 * price of TSM (an ADR, in US dollars) is never presented as 2330's.
 *
 * Checked on 2026-10-25 against SEC company_tickers.json (CIKs) and the price
 * source (every symbol returned five years of daily closes, or its listing
 * date). Listings for the directory companies agree with
 * research/listings.json; the six names not in the directory yet (Tesla,
 * Cameco, Kazatomprom, NuScale, Oklo, and the listed parents Intel, Alphabet
 * and Amazon) carry the slug a company page would take.
 */
import { MARKET_SEED, type MarketCompany, type Ticker } from '@/config/market-seed';

export {
  MARKET_SEED,
  MARKET_SEED_CHECKED_ON,
  type Exchange,
  type MarketCompany,
  type Ticker,
} from '@/config/market-seed';

/** Tickers a question may write instead of the name; short or common-word ones are left out. */
const TICKER_WORDS = new Set([
  'NVDA',
  'AMD',
  'TSM',
  'INTC',
  'AMAT',
  'LRCX',
  'KLAC',
  'GEV',
  'MSFT',
  'GOOGL',
  'AMZN',
  'TSLA',
  'CCJ',
  'OKLO',
]);

export const tickerKey = (t: Ticker) => `${t.exchange}:${t.symbol}`;

export function byTicker(t: Ticker): MarketCompany | undefined {
  return MARKET_SEED.find((c) => c.ticker.exchange === t.exchange && c.ticker.symbol === t.symbol);
}

export function byCik(cik: number): MarketCompany | undefined {
  return MARKET_SEED.find((c) => c.cik === cik);
}

/** By its own slug or a directory page it is the listed parent of. */
export function bySlug(slug: string): MarketCompany | undefined {
  return MARKET_SEED.find((c) => c.slug === slug || c.pages?.includes(slug));
}

const norm = (s: string) =>
  ` ${s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;

/** A company named by slug, name, alias or ticker ("NVDA", "nvidia", "Intel Foundry"). */
export function findMarketCompany(text: string): MarketCompany | undefined {
  return (
    marketCompaniesIn(text, 1)[0] ??
    MARKET_SEED.find((c) => c.ticker.symbol === text.trim().toUpperCase())
  );
}

/** The seed companies a question names, in the order they appear in it. */
export function marketCompaniesIn(question: string, max = 3): MarketCompany[] {
  const q = norm(question);
  const words = new Set(question.match(/\b[A-Z]{3,5}\b/g) ?? []);
  const hits: { c: MarketCompany; at: number }[] = [];
  for (const c of MARKET_SEED) {
    const names = [
      c.name,
      c.slug.replace(/-/g, ' '),
      ...(c.aliases ?? []),
      ...(c.pages ?? []).map((p) => p.replace(/-/g, ' ')),
    ];
    let at = Math.min(...names.map((n) => q.indexOf(norm(n))).filter((i) => i >= 0), Infinity);
    if (at === Infinity && TICKER_WORDS.has(c.ticker.symbol) && words.has(c.ticker.symbol))
      at = question.indexOf(c.ticker.symbol);
    if (at !== Infinity) hits.push({ c, at });
  }
  return hits
    .sort((a, b) => a.at - b.at)
    .slice(0, max)
    .map((h) => h.c);
}

/** "NVDA (NASDAQ)", "8035 (Tokyo)": the line a figure is of. */
export function tickerLabel(t: Ticker): string {
  return `${t.symbol} (${t.exchange})`;
}
