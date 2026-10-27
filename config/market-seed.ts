/**
 * The market seed: one listing per company, with its SEC registrant id where
 * it has one. Read through lib/market-data/identity.ts, which explains the
 * seam and holds the lookups; this file is only the rows, so the company
 * universe can replace it whole.
 */
/** When every row below was last checked (config/substrata-freshness.ts judges it). */
export const MARKET_SEED_CHECKED_ON = '2026-10-25';

export type Exchange =
  | 'NASDAQ'
  | 'NYSE'
  | 'Euronext Amsterdam'
  | 'Euronext Paris'
  | 'Tokyo'
  | 'Xetra'
  | 'ASX'
  | 'LSE'
  // Venues a universe listing names (lib/market-data/company.ts). "US" is the
  // composite a fund file prints when it does not say which US exchange.
  | 'US'
  | 'London'
  | 'Hong Kong'
  | 'Korea'
  | 'Taiwan'
  | 'Toronto'
  | 'SIX';

export interface Ticker {
  exchange: Exchange;
  symbol: string;
}

export interface MarketCompany {
  /** The company slug a page takes (`/markets/<slug>`). */
  slug: string;
  name: string;
  /** Directory pages whose listed parent this is (Intel Foundry → Intel). */
  pages?: string[];
  /** Other names a question uses for it. */
  aliases?: string[];
  ticker: Ticker;
  /** Trading currency of `ticker`. */
  currency: string;
  /** SEC registrant id; absent when the company does not file with the SEC. */
  cik?: number;
  /** The listing is a depositary receipt: what one stands for. */
  depositary?: string;
  /** Where it also trades at home, in words. */
  home?: string;
  /** Anything a reader of its price history must know. */
  note?: string;
  /**
   * Whether price × the cover-page share count is that line's market value.
   * False with the reason when it is not (several share classes, an ADR ratio).
   */
  marketCap: true | string;
  /** Several share classes: holders' percents are each of one class and do not add up. */
  multiClass?: true;
}

const ADR_CAP =
  'the listing is a depositary receipt, so its price times the share count is not the market value without the ratio';
const CLASSES =
  'several share classes trade at different prices; one line’s price times all shares is not the market value';
const NO_SEC = 'it does not file with the SEC, so no share count is read here';

export const MARKET_SEED: readonly MarketCompany[] = [
  {
    slug: 'nvidia',
    name: 'NVIDIA',
    ticker: { exchange: 'NASDAQ', symbol: 'NVDA' },
    currency: 'USD',
    cik: 1045810,
    marketCap: true,
  },
  {
    slug: 'amd',
    name: 'AMD',
    aliases: ['Advanced Micro Devices'],
    ticker: { exchange: 'NASDAQ', symbol: 'AMD' },
    currency: 'USD',
    cik: 2488,
    marketCap: true,
  },
  {
    slug: 'tsmc',
    name: 'TSMC',
    aliases: ['Taiwan Semiconductor'],
    ticker: { exchange: 'NYSE', symbol: 'TSM' },
    currency: 'USD',
    cik: 1046179,
    depositary: 'one ADR represents five ordinary shares',
    home: '2330 on the Taiwan Stock Exchange, in TWD',
    marketCap: ADR_CAP,
  },
  {
    slug: 'asml',
    name: 'ASML',
    ticker: { exchange: 'NASDAQ', symbol: 'ASML' },
    currency: 'USD',
    cik: 937966,
    home: 'ASML on Euronext Amsterdam, in EUR',
    marketCap: 'the cover-page share count covers both the Amsterdam and the New York line',
  },
  {
    slug: 'intel',
    name: 'Intel',
    pages: ['intel-foundry'],
    ticker: { exchange: 'NASDAQ', symbol: 'INTC' },
    currency: 'USD',
    cik: 50863,
    marketCap: true,
  },
  {
    slug: 'micron',
    name: 'Micron',
    aliases: ['Micron Technology'],
    ticker: { exchange: 'NASDAQ', symbol: 'MU' },
    currency: 'USD',
    cik: 723125,
    marketCap: true,
  },
  {
    slug: 'applied-materials',
    name: 'Applied Materials',
    ticker: { exchange: 'NASDAQ', symbol: 'AMAT' },
    currency: 'USD',
    cik: 6951,
    marketCap: true,
  },
  {
    slug: 'lam-research',
    name: 'Lam Research',
    ticker: { exchange: 'NASDAQ', symbol: 'LRCX' },
    currency: 'USD',
    cik: 707549,
    marketCap: true,
  },
  {
    slug: 'kla',
    name: 'KLA',
    ticker: { exchange: 'NASDAQ', symbol: 'KLAC' },
    currency: 'USD',
    cik: 319201,
    marketCap: true,
  },
  {
    slug: 'asm-international',
    name: 'ASM International',
    aliases: ['ASMI'],
    ticker: { exchange: 'Euronext Amsterdam', symbol: 'ASM' },
    currency: 'EUR',
    marketCap: NO_SEC,
  },
  {
    slug: 'tokyo-electron',
    name: 'Tokyo Electron',
    ticker: { exchange: 'Tokyo', symbol: '8035' },
    currency: 'JPY',
    marketCap: NO_SEC,
  },
  {
    slug: 'ge-vernova',
    name: 'GE Vernova',
    ticker: { exchange: 'NYSE', symbol: 'GEV' },
    currency: 'USD',
    cik: 1996810,
    note: 'Trades since its spin-off from GE on 2024-04-02.',
    marketCap: true,
  },
  {
    slug: 'siemens-energy',
    name: 'Siemens Energy',
    ticker: { exchange: 'Xetra', symbol: 'ENR' },
    currency: 'EUR',
    cik: 1830056,
    marketCap: NO_SEC,
  },
  {
    slug: 'linde',
    name: 'Linde',
    ticker: { exchange: 'NASDAQ', symbol: 'LIN' },
    currency: 'USD',
    cik: 1707925,
    marketCap: true,
  },
  {
    slug: 'air-liquide',
    name: 'Air Liquide',
    ticker: { exchange: 'Euronext Paris', symbol: 'AI' },
    currency: 'EUR',
    cik: 1161167,
    marketCap: NO_SEC,
  },
  {
    slug: 'rio-tinto',
    name: 'Rio Tinto',
    ticker: { exchange: 'NYSE', symbol: 'RIO' },
    currency: 'USD',
    cik: 863064,
    depositary: 'one ADR represents one Rio Tinto plc ordinary share',
    home: 'RIO on the London Stock Exchange and RIO on the ASX (Rio Tinto Limited)',
    marketCap:
      'Rio Tinto is a dual-listed company (plc and Limited); one line is not the whole group',
  },
  {
    slug: 'mp-materials',
    name: 'MP Materials',
    ticker: { exchange: 'NYSE', symbol: 'MP' },
    currency: 'USD',
    cik: 1801368,
    marketCap: true,
  },
  {
    slug: 'lynas-rare-earths',
    name: 'Lynas',
    aliases: ['Lynas Rare Earths'],
    ticker: { exchange: 'ASX', symbol: 'LYC' },
    currency: 'AUD',
    marketCap: NO_SEC,
  },
  {
    slug: 'wolfspeed',
    name: 'Wolfspeed',
    ticker: { exchange: 'NYSE', symbol: 'WOLF' },
    currency: 'USD',
    cik: 895419,
    note: 'Its shares were cancelled in the 2025 Chapter 11 reorganisation; the history here starts with the new shares, which began trading on 2025-09-29.',
    marketCap: true,
  },
  {
    slug: 'microsoft',
    name: 'Microsoft',
    ticker: { exchange: 'NASDAQ', symbol: 'MSFT' },
    currency: 'USD',
    cik: 789019,
    marketCap: true,
  },
  {
    slug: 'alphabet',
    name: 'Alphabet',
    pages: ['google'],
    aliases: ['Google'],
    ticker: { exchange: 'NASDAQ', symbol: 'GOOGL' },
    currency: 'USD',
    cik: 1652044,
    marketCap: CLASSES,
    multiClass: true,
  },
  {
    slug: 'meta',
    name: 'Meta',
    aliases: ['Meta Platforms', 'Facebook'],
    ticker: { exchange: 'NASDAQ', symbol: 'META' },
    currency: 'USD',
    cik: 1326801,
    marketCap: CLASSES,
    multiClass: true,
  },
  {
    slug: 'amazon',
    name: 'Amazon',
    pages: ['amazon-web-services'],
    ticker: { exchange: 'NASDAQ', symbol: 'AMZN' },
    currency: 'USD',
    cik: 1018724,
    marketCap: true,
  },
  {
    slug: 'tesla',
    name: 'Tesla',
    ticker: { exchange: 'NASDAQ', symbol: 'TSLA' },
    currency: 'USD',
    cik: 1318605,
    marketCap: true,
  },
  {
    slug: 'cameco',
    name: 'Cameco',
    ticker: { exchange: 'NYSE', symbol: 'CCJ' },
    currency: 'USD',
    cik: 1009001,
    home: 'CCO on the Toronto Stock Exchange, in CAD',
    marketCap: 'its reports are in Canadian dollars and the line here trades in US dollars',
  },
  {
    slug: 'kazatomprom',
    name: 'Kazatomprom',
    ticker: { exchange: 'LSE', symbol: 'KAP' },
    currency: 'USD',
    depositary: 'one GDR represents one ordinary share',
    home: 'KZAP on the Astana International Exchange',
    marketCap: NO_SEC,
  },
  {
    slug: 'nuscale-power',
    name: 'NuScale',
    aliases: ['NuScale Power'],
    ticker: { exchange: 'NYSE', symbol: 'SMR' },
    currency: 'USD',
    cik: 1822966,
    marketCap: CLASSES,
    multiClass: true,
  },
  {
    slug: 'oklo',
    name: 'Oklo',
    ticker: { exchange: 'NYSE', symbol: 'OKLO' },
    currency: 'USD',
    cik: 1849056,
    marketCap: true,
  },
];
