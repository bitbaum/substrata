/**
 * Where universe evidence is read from: the thematic funds whose issuers
 * publish a downloadable holdings file, the SEC industry codes that are theme
 * codes, and the Wikidata industry classes that are theme classes. Each is a
 * free public source; each was opened from the build sandbox on 2026-10-25
 * (what could not be read is said beside it).
 *
 * A fund holding proves THEME INTEREST — an issuer selling a fund about the
 * theme chose to hold it — never a role in any chain. A Tier B page says so.
 *
 * Decided: docs/architecture/2026-10-25-company-universe.md §3.
 */
import type { ThemeId } from './universe-themes';

export type HoldingsFormat = 'ark-csv' | 'globalx-csv' | 'ft-html' | 'defiance-html' | 'ssga-xlsx';

export interface Fund {
  /** `<issuer>-<ticker>`, lower case. */
  id: string;
  ticker: string;
  name: string;
  issuer: string;
  theme: ThemeId;
  format: HoldingsFormat;
  /**
   * The holdings file. `{date}` (YYYYMMDD) is filled with the newest business
   * day the issuer has published, tried backwards from today.
   */
  url: string;
}

export const FUNDS: readonly Fund[] = [
  {
    id: 'ark-arkq',
    ticker: 'ARKQ',
    name: 'ARK Autonomous Technology & Robotics ETF',
    issuer: 'ARK Invest',
    theme: 'robotics',
    format: 'ark-csv',
    url: 'https://assets.ark-funds.com/fund-documents/funds-etf-csv/ARK_AUTONOMOUS_TECH._&_ROBOTICS_ETF_ARKQ_HOLDINGS.csv',
  },
  {
    id: 'ark-arkx',
    ticker: 'ARKX',
    name: 'ARK Space & Defense Innovation ETF',
    issuer: 'ARK Invest',
    theme: 'space',
    format: 'ark-csv',
    // Read 2026-10-25: the issuer's file is dated 01/02/2026, so the freshness
    // rule (MAX_AGE_DAYS.fund) refuses it. Kept so the refusal is visible.
    url: 'https://assets.ark-funds.com/fund-documents/funds-etf-csv/ARK_SPACE_EXPLORATION_&_INNOVATION_ETF_ARKX_HOLDINGS.csv',
  },
  {
    id: 'ark-arkg',
    ticker: 'ARKG',
    name: 'ARK Genomic Revolution ETF',
    issuer: 'ARK Invest',
    theme: 'biotools',
    format: 'ark-csv',
    url: 'https://assets.ark-funds.com/fund-documents/funds-etf-csv/ARK_GENOMIC_REVOLUTION_ETF_ARKG_HOLDINGS.csv',
  },
  ...(
    [
      ['botz', 'Global X Robotics & Artificial Intelligence ETF', 'robotics'],
      ['aiq', 'Global X Artificial Intelligence & Technology ETF', 'ai'],
      ['dtcr', 'Global X Data Center & Digital Infrastructure ETF', 'ai'],
      ['driv', 'Global X Autonomous & Electric Vehicles ETF', 'mobility'],
      ['lit', 'Global X Lithium & Battery Tech ETF', 'grid'],
      ['ura', 'Global X Uranium ETF', 'nuclear'],
      ['copx', 'Global X Copper Miners ETF', 'materials'],
    ] as const
  ).map(([t, name, theme]) => ({
    id: `globalx-${t}`,
    ticker: t.toUpperCase(),
    name,
    issuer: 'Global X',
    theme,
    format: 'globalx-csv' as const,
    url: `https://assets.globalxetfs.com/funds/holdings/${t}_full-holdings_{date}.csv`,
  })),
  ...(
    [
      ['shld', 'Global X Defense Tech ETF', 'defence'],
      ['clou', 'Global X Cloud Computing ETF', 'ai'],
      ['gnom', 'Global X Genomics & Biotechnology ETF', 'biotools'],
    ] as const
  ).map(([t, name, theme]) => ({
    id: `globalx-${t}`,
    ticker: t.toUpperCase(),
    name,
    issuer: 'Global X',
    theme,
    format: 'globalx-csv' as const,
    url: `https://assets.globalxetfs.com/funds/holdings/${t}_full-holdings_{date}.csv`,
  })),
  ...(
    [
      ['xar', 'SPDR S&P Aerospace & Defense ETF', 'defence'],
      ['hail', 'SPDR S&P Kensho Smart Mobility ETF', 'mobility'],
    ] as const
  ).map(([t, name, theme]) => ({
    id: `ssga-${t}`,
    ticker: t.toUpperCase(),
    name,
    issuer: 'State Street',
    theme,
    format: 'ssga-xlsx' as const,
    url: `https://www.ssga.com/us/en/intermediary/library-content/products/fund-data/etfs/us/holdings-daily-us-en-${t}.xlsx`,
  })),
  ...(
    [
      ['ROBT', 'First Trust Nasdaq Artificial Intelligence and Robotics ETF', 'robotics'],
      ['FTXL', 'First Trust Nasdaq Semiconductor ETF', 'compute'],
      ['SKYY', 'First Trust Cloud Computing ETF', 'ai'],
    ] as const
  ).map(([t, name, theme]) => ({
    id: `ft-${t.toLowerCase()}`,
    ticker: t,
    name,
    issuer: 'First Trust',
    theme,
    format: 'ft-html' as const,
    url: `https://www.ftportfolios.com/Retail/Etf/EtfHoldings.aspx?Ticker=${t}`,
  })),
  {
    id: 'ft-grid',
    ticker: 'GRID',
    name: 'First Trust NASDAQ Clean Edge Smart Grid Infrastructure Index Fund',
    issuer: 'First Trust',
    theme: 'grid',
    format: 'ft-html',
    url: 'https://www.ftportfolios.com/Retail/Etf/EtfHoldings.aspx?Ticker=GRID',
  },
  {
    id: 'defiance-qtum',
    ticker: 'QTUM',
    name: 'Defiance Quantum ETF',
    issuer: 'Defiance ETFs',
    theme: 'quantum',
    format: 'defiance-html',
    url: 'https://www.defianceetfs.com/qtum-full-holdings/',
  },
  {
    id: 'ssga-rokt',
    ticker: 'ROKT',
    name: 'SPDR S&P Kensho Final Frontiers ETF',
    issuer: 'State Street',
    theme: 'space',
    format: 'ssga-xlsx',
    url: 'https://www.ssga.com/us/en/intermediary/library-content/products/fund-data/etfs/us/holdings-daily-us-en-rokt.xlsx',
  },
  {
    id: 'ssga-xsd',
    ticker: 'XSD',
    name: 'SPDR S&P Semiconductor ETF',
    issuer: 'State Street',
    theme: 'compute',
    format: 'ssga-xlsx',
    url: 'https://www.ssga.com/us/en/intermediary/library-content/products/fund-data/etfs/us/holdings-daily-us-en-xsd.xlsx',
  },
];

/** Tried from the sandbox and not usable, with why — so nobody tries them blind. */
export const FUNDS_NOT_READ: readonly { fund: string; url: string; why: string }[] = [
  {
    fund: 'iShares Semiconductor ETF (SOXX)',
    url: 'https://www.ishares.com/us/products/239705/ishares-phlx-semiconductor-etf/1467271812596.ajax?fileType=csv&fileName=SOXX_holdings&dataType=fund',
    why: 'Answers 200 with an HTML page instead of the CSV from this sandbox; XSD covers the theme.',
  },
  {
    fund: 'Invesco Solar / clean-energy funds',
    url: 'https://www.invesco.com/us/financial-products/etfs/holdings/main/holdings/0?audienceType=Investor&action=download&ticker=PBW',
    why: 'Answers 406 to a scripted download.',
  },
  {
    fund: 'VanEck Uranium & Nuclear ETF (NLR)',
    url: 'https://www.vaneck.com/us/en/investments/uranium-nuclear-energy-etf-nlr/holdings/',
    why: 'Redirects to a consent page; URA covers the theme.',
  },
  {
    fund: 'Range Nuclear Renaissance ETF (NUKZ)',
    url: 'https://www.rangeetfs.com/nukz',
    why: 'Holdings are drawn by script in the browser; no file is published.',
  },
];

/**
 * SEC Standard Industrial Classification codes that are theme codes. The SIC
 * code is what the filer itself reports as its line of business.
 */
export const SIC_THEMES: readonly { sic: string; label: string; theme: ThemeId }[] = [
  { sic: '3674', label: 'Semiconductors & related devices', theme: 'compute' },
  { sic: '3827', label: 'Optical instruments & lenses', theme: 'photonics' },
  { sic: '3691', label: 'Storage batteries', theme: 'grid' },
  { sic: '3761', label: 'Guided missiles & space vehicles', theme: 'space' },
  { sic: '3826', label: 'Laboratory analytical instruments', theme: 'biotools' },
  { sic: '1094', label: 'Uranium-radium-vanadium ores', theme: 'nuclear' },
  { sic: '3559', label: 'Special industry machinery, NEC', theme: 'compute' },
  { sic: '3572', label: 'Computer storage devices', theme: 'compute' },
  { sic: '3571', label: 'Electronic computers', theme: 'ai' },
  { sic: '3576', label: 'Computer communications equipment', theme: 'ai' },
  { sic: '3569', label: 'General industrial machinery & equipment, NEC', theme: 'robotics' },
  { sic: '3711', label: 'Motor vehicles & passenger car bodies', theme: 'mobility' },
  { sic: '3612', label: 'Power, distribution & specialty transformers', theme: 'grid' },
  { sic: '3613', label: 'Switchgear & switchboard apparatus', theme: 'grid' },
  { sic: '3621', label: 'Motors & generators', theme: 'grid' },
  { sic: '1000', label: 'Metal mining', theme: 'materials' },
  {
    sic: '3812',
    label: 'Search, detection, navigation, guidance, aeronautical systems',
    theme: 'defence',
  },
  {
    sic: '3480',
    label: 'Ordnance & accessories, except vehicles & guided missiles',
    theme: 'defence',
  },
  { sic: '3721', label: 'Aircraft', theme: 'defence' },
  { sic: '3728', label: 'Aircraft parts & auxiliary equipment, NEC', theme: 'defence' },
];

/**
 * Wikidata industry classes (P452 values) that are theme classes. Only
 * classes whose QID was opened and read are listed. Wikidata is edited by
 * anyone, so a class alone never admits: it counts for the theme test and
 * the company still needs a cited size figure.
 */
export const WIKIDATA_INDUSTRIES: readonly { qid: string; label: string; theme: ThemeId }[] = [
  { qid: 'Q170978', label: 'robotics', theme: 'robotics' },
  { qid: 'Q2729047', label: 'space industry', theme: 'space' },
  { qid: 'Q4072210', label: 'nuclear industry', theme: 'nuclear' },
  { qid: 'Q17995793', label: 'quantum computing', theme: 'quantum' },
  { qid: 'Q138645524', label: 'AI industry', theme: 'ai' },
  { qid: 'Q122198663', label: 'electric vehicle industry', theme: 'mobility' },
  { qid: 'Q467054', label: 'photonics', theme: 'photonics' },
  { qid: 'Q1469765', label: 'optical communication', theme: 'photonics' },
  { qid: 'Q392933', label: 'weapons industry', theme: 'defence' },
];
