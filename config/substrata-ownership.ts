/**
 * Who owns each company, as rows a reader can check.
 *
 * The owner's words (2026-10-23): a company profile says "if it's a public
 * company or private company, who the owners are, who investors are". This
 * file is the one place that answer lives. Each row is a holder named by a
 * document — an annual report, a 20-F, a proxy statement, the company's own
 * investor page, a regulatory notice — with the URL and the date the figure
 * is as of. A holder whose share nobody has read off such a document carries
 * `share: null` and renders as a lead, exactly as an unsourced producer row
 * does elsewhere in the corpus. No percentage here is estimated, rounded up
 * from a press summary or derived from a market-data aggregator; where only
 * an aggregator names the holder, the share is null and the aggregator is
 * cited as what it is.
 *
 * Shares are of the listed parent where the directory row is a division or
 * subsidiary (Samsung Foundry → Samsung Electronics), and the row says so.
 *
 * Test: test/ownership.test.ts — every holder has a source URL and an as-of
 * date, no company's named shares sum past 100, every slug is in the
 * directory.
 */

import { withCandidateHolders } from '../lib/entry/candidate';
import ownershipCandidates from './candidates/ownership.json';

export { HOLDER_KIND_LABEL, OWNERSHIP_STATUS_LABEL } from './substrata-ownership-labels';

export type OwnershipStatus = 'listed' | 'private' | 'subsidiary' | 'state-owned';

export type HolderKind = 'founder' | 'state' | 'fund' | 'strategic' | 'public-float';

export interface Holder {
  name: string;
  /** Per cent of shares (or of voting rights, when `note` says so). Null = not read off a document. */
  share: number | null;
  kind: HolderKind;
  /** YYYY, YYYY-MM or YYYY-MM-DD: the date the figure is as of. */
  asOf: string;
  /** The document the figure (or, for a lead, the name) was read from. */
  source: string;
  /** Anything a reader needs to read the figure right: voting rights vs capital, via which vehicle. */
  note?: string;
  /** Only on a row from config/candidates/: a model's, not yet promoted by a person. */
  evidence?: 'candidate';
  /** YYYY-MM-DD the document was read, where the row records it (candidate rows always do). */
  readOn?: string;
}

export interface Ownership {
  /** Directory slug (lib/participants). */
  company: string;
  status: OwnershipStatus;
  /** For a subsidiary: whose shares the holders below are of. */
  parent?: string;
  /** For a private or state-owned firm: who owns it, in one line, where no percentage is on record. */
  ownedBy?: string;
  holders: Holder[];
}

const SAMSUNG_ELECTRONICS_HOLDERS: Holder[] = [
  {
    name: 'Samsung Life Insurance',
    share: null,
    kind: 'strategic',
    asOf: '2025-02-12',
    source: 'https://www.kedglobal.com/corporate-restructuring/newsView/ked202502120002',
    note: 'Press account of the February 2025 stake sale; reported at 8.51% before it. Not yet read off the business report.',
  },
  {
    name: 'Lee Jae-yong',
    share: null,
    kind: 'founder',
    asOf: '2021-04-30',
    source: 'https://www.kedglobal.com/samsung-group/newsView/ked202104300009',
    note: 'Chairman; press account of the 2021 inheritance split. Not yet read off the business report.',
  },
];

const CORPUS_OWNERSHIP: readonly Ownership[] = [
  {
    company: 'asml',
    status: 'listed',
    holders: [
      {
        name: 'Capital Research and Management',
        share: 10.33,
        kind: 'fund',
        asOf: '2025-02-26',
        source:
          'https://www.sec.gov/Archives/edgar/data/937966/000093796625000011/a2024annualreportbasedon.htm',
        note: 'Annual report 2024, holders notified to the AFM or SEC at 3% or more.',
      },
      {
        name: 'BlackRock',
        share: 7.95,
        kind: 'fund',
        asOf: '2025-02-26',
        source:
          'https://www.sec.gov/Archives/edgar/data/937966/000093796625000011/a2024annualreportbasedon.htm',
        note: 'Annual report 2024, holders notified to the AFM or SEC at 3% or more.',
      },
    ],
  },
  {
    company: 'tsmc',
    status: 'listed',
    holders: [
      {
        name: 'ADR holders (Citibank as depositary)',
        share: 20.49,
        kind: 'public-float',
        asOf: '2025',
        source:
          'https://investor.tsmc.com/static/annualReports/2025/english/pdf/2025_tsmc_ar_e_ch4.pdf',
        note: 'Annual report 2025, major shareholders; the depositary bank holds these for ADR investors.',
      },
      {
        name: 'National Development Fund, Executive Yuan',
        share: 6.38,
        kind: 'state',
        asOf: '2025',
        source:
          'https://investor.tsmc.com/static/annualReports/2025/english/pdf/2025_tsmc_ar_e_ch4.pdf',
        note: 'Annual report 2025, major shareholders. Taiwan’s government fund, with a board seat.',
      },
      {
        name: 'Government of Singapore',
        share: 2.08,
        kind: 'state',
        asOf: '2025',
        source:
          'https://investor.tsmc.com/static/annualReports/2025/english/pdf/2025_tsmc_ar_e_ch4.pdf',
        note: 'Annual report 2025, major shareholders.',
      },
    ],
  },
  {
    company: 'tsmc-advanced-packaging',
    status: 'subsidiary',
    parent: 'TSMC',
    holders: [],
  },
  {
    company: 'nvidia',
    status: 'listed',
    holders: [
      {
        name: 'BlackRock',
        share: 7.43,
        kind: 'fund',
        asOf: '2026-03-23',
        source:
          'https://www.sec.gov/Archives/edgar/data/0001045810/000104581026000038/a2026-annualxreportxwebxfi.pdf',
        note: 'Annual report and proxy for fiscal 2026, beneficial ownership table.',
      },
      {
        name: 'Vanguard',
        share: 7.31,
        kind: 'fund',
        asOf: '2026-03-23',
        source:
          'https://www.sec.gov/Archives/edgar/data/0001045810/000104581026000038/a2026-annualxreportxwebxfi.pdf',
        note: 'Annual report and proxy for fiscal 2026, beneficial ownership table.',
      },
      {
        name: 'Jensen Huang',
        share: 3.58,
        kind: 'founder',
        asOf: '2026-03-23',
        source:
          'https://www.sec.gov/Archives/edgar/data/0001045810/000104581026000038/a2026-annualxreportxwebxfi.pdf',
        note: 'Co-founder and CEO; annual report and proxy for fiscal 2026.',
      },
    ],
  },
  {
    company: 'applied-materials',
    status: 'listed',
    holders: [
      {
        name: 'BlackRock',
        share: 9.69,
        kind: 'fund',
        asOf: '2025-12-31',
        source: 'https://www.sec.gov/Archives/edgar/data/6951/000119312526027307/d71992ddef14a.htm',
        note: '2026 proxy statement, principal stockholders.',
      },
      {
        name: 'Vanguard',
        share: 9.35,
        kind: 'fund',
        asOf: '2025-12-31',
        source: 'https://www.sec.gov/Archives/edgar/data/6951/000119312526027307/d71992ddef14a.htm',
        note: '2026 proxy statement, principal stockholders.',
      },
    ],
  },
  {
    company: 'lam-research',
    status: 'listed',
    holders: [
      {
        name: 'Vanguard',
        share: 10.24,
        kind: 'fund',
        asOf: '2025-09-05',
        source:
          'https://www.sec.gov/Archives/edgar/data/707549/000114036125036012/ny20050572x2_def14a.htm',
        note: '2025 proxy statement, 5% holders.',
      },
      {
        name: 'BlackRock',
        share: 9.34,
        kind: 'fund',
        asOf: '2025-09-05',
        source:
          'https://www.sec.gov/Archives/edgar/data/707549/000114036125036012/ny20050572x2_def14a.htm',
        note: '2025 proxy statement, 5% holders.',
      },
    ],
  },
  {
    company: 'kla',
    status: 'listed',
    holders: [
      {
        name: 'Vanguard',
        share: 10.3,
        kind: 'fund',
        asOf: '2025-09-10',
        source:
          'https://www.sec.gov/Archives/edgar/data/319201/000119312525213294/d913108ddef14a.htm',
        note: '2025 proxy statement, 5% holders.',
      },
      {
        name: 'BlackRock',
        share: 8.8,
        kind: 'fund',
        asOf: '2025-09-10',
        source:
          'https://www.sec.gov/Archives/edgar/data/319201/000119312525213294/d913108ddef14a.htm',
        note: '2025 proxy statement, 5% holders.',
      },
    ],
  },
  {
    company: 'tokyo-electron',
    status: 'listed',
    holders: [
      {
        name: 'BlackRock',
        share: null,
        kind: 'fund',
        asOf: '2026-10-23',
        source:
          'https://simplywall.st/stocks/us/semiconductors/otc-toel.f/tokyo-electron/ownership',
        note: 'Named by a market-data aggregator only; not yet read off the securities report.',
      },
    ],
  },
  {
    company: 'carl-zeiss-smt',
    status: 'subsidiary',
    parent: 'Carl Zeiss AG',
    ownedBy:
      'Carl Zeiss AG, whose sole shareholder is the Carl-Zeiss-Stiftung; ASML holds a minority',
    holders: [
      {
        name: 'Carl Zeiss AG',
        share: 75.1,
        kind: 'strategic',
        asOf: '2016-11-03',
        source:
          'https://www.zeiss.com/corporate/en/about-us/present/newsroom/press-releases/2016/zeiss-achieves-record-revenue-and-earnings.html',
        note: 'The remainder after ASML’s 24.9%, as Zeiss stated the sale. Carl Zeiss AG is itself wholly owned by the Carl-Zeiss-Stiftung.',
      },
      {
        name: 'ASML',
        share: 24.9,
        kind: 'strategic',
        asOf: '2016-11-03',
        source:
          'https://www.asml.com/en/news/press-releases/2016/zeiss-and-asml-strengthen-partnership-for-next-generation-of-euv-lithography',
        note: 'Minority stake bought for EUR 1 billion; approvals announced June 2017.',
      },
      {
        name: 'Carl-Zeiss-Stiftung',
        share: null,
        kind: 'founder',
        asOf: '2024',
        source: 'https://www.carl-zeiss-stiftung.de/en/foundation/structure',
        note: 'Sole shareholder of Carl Zeiss AG; may not sell its shares under the foundation statute. Indirect: no percentage of SMT itself.',
      },
    ],
  },
  {
    company: 'samsung-foundry',
    status: 'subsidiary',
    parent: 'Samsung Electronics',
    holders: SAMSUNG_ELECTRONICS_HOLDERS,
  },
  {
    company: 'samsung-memory',
    status: 'subsidiary',
    parent: 'Samsung Electronics',
    holders: SAMSUNG_ELECTRONICS_HOLDERS,
  },
  {
    company: 'sk-hynix',
    status: 'listed',
    holders: [
      {
        name: 'SK Square',
        share: null,
        kind: 'strategic',
        asOf: '2026-10-23',
        source:
          'https://uk.marketscreener.com/quote/stock/SK-HYNIX-INC-6494929/company-shareholders/',
        note: 'The group holding company; named by a market-data aggregator (about 20%). Not yet read off the business report.',
      },
      {
        name: 'National Pension Service',
        share: null,
        kind: 'state',
        asOf: '2026-10-23',
        source:
          'https://uk.marketscreener.com/quote/stock/SK-HYNIX-INC-6494929/company-shareholders/',
        note: 'Korea’s public pension fund; named by a market-data aggregator. Not yet read off the business report.',
      },
    ],
  },
  {
    company: 'micron',
    status: 'listed',
    holders: [
      {
        name: 'Vanguard',
        share: 8.2,
        kind: 'fund',
        asOf: '2021-12-31',
        source:
          'https://www.sec.gov/Archives/edgar/data/723125/000072312522000063/a2022definitiveproxy.htm',
        note: 'Proxy statement filed 2022, principal stockholders. A newer proxy has not been read yet.',
      },
      {
        name: 'BlackRock',
        share: 7.8,
        kind: 'fund',
        asOf: '2021-12-31',
        source:
          'https://www.sec.gov/Archives/edgar/data/723125/000072312522000063/a2022definitiveproxy.htm',
        note: 'Proxy statement filed 2022, principal stockholders. A newer proxy has not been read yet.',
      },
    ],
  },
  {
    company: 'intel-foundry',
    status: 'subsidiary',
    parent: 'Intel',
    holders: [
      {
        name: 'United States government',
        share: 9.9,
        kind: 'state',
        asOf: '2025-08-22',
        source:
          'https://www.sec.gov/Archives/edgar/data/50863/000005086325000129/a08222025form8-kex991.htm',
        note: '433.3 million primary shares of Intel at $20.47; passive, no board seat; plus a five-year warrant for a further 5% if Intel’s foundry ownership falls below 51%.',
      },
    ],
  },
  {
    company: 'ge-vernova',
    status: 'listed',
    holders: [
      {
        name: 'Vanguard',
        share: 8.7,
        kind: 'fund',
        asOf: '2025-03-03',
        source:
          'https://www.sec.gov/Archives/edgar/data/1996810/000199681025000049/gev-20250328.htm',
        note: '2025 proxy statement, holders of more than 5%.',
      },
      {
        name: 'FMR (Fidelity)',
        share: 8.7,
        kind: 'fund',
        asOf: '2025-03-03',
        source:
          'https://www.sec.gov/Archives/edgar/data/1996810/000199681025000049/gev-20250328.htm',
        note: '2025 proxy statement, holders of more than 5%.',
      },
      {
        name: 'BlackRock',
        share: 6.5,
        kind: 'fund',
        asOf: '2025-03-03',
        source:
          'https://www.sec.gov/Archives/edgar/data/1996810/000199681025000049/gev-20250328.htm',
        note: '2025 proxy statement, holders of more than 5%.',
      },
      {
        name: 'Capital International Investors',
        share: 5.6,
        kind: 'fund',
        asOf: '2025-03-03',
        source:
          'https://www.sec.gov/Archives/edgar/data/1996810/000199681025000049/gev-20250328.htm',
        note: '2025 proxy statement, holders of more than 5%.',
      },
    ],
  },
  {
    company: 'siemens-energy',
    status: 'listed',
    holders: [
      {
        name: 'Siemens AG',
        share: null,
        kind: 'strategic',
        asOf: '2024-06-14',
        source:
          'https://www.finanzen.at/nachrichten/aktien/eqs-pvr-siemens-energy-ag-release-according-to-article-40-section-1-of-the-wphg-[the-german-securities-trading-act]-with-the-objective-of-europe-wide-distribution-1033483234',
        note: 'Former parent. A voluntary group voting-rights notice of June 2024 reported 22.07% including Siemens Pension-Trust; Siemens has since reduced the stake. Not read off the annual report as a share of capital.',
      },
    ],
  },
  {
    company: 'lynas-rare-earths',
    status: 'listed',
    holders: [
      {
        name: 'Hancock Prospecting',
        share: null,
        kind: 'strategic',
        asOf: '2024-04-17',
        source:
          'https://www.engineeringnews.co.za/article/rinehart-takes-stake-in-lynas-rare-earths-shares-jump-2024-04-17',
        note: 'Gina Rinehart’s company; 5.82% at its first substantial-holder notice, reported by Reuters. The current notice has not been read.',
      },
    ],
  },
  {
    company: 'mp-materials',
    status: 'listed',
    holders: [
      {
        name: 'United States Department of Defense',
        share: null,
        kind: 'state',
        asOf: '2025-07-10',
        source:
          'https://www.nasdaq.com/articles/dod-invests-us-400-million-rare-earth-firm-mp-materials',
        note: '$400 million of convertible preferred stock plus a warrant; about 15% if fully converted and exercised, per the announcement. The filed terms have not been read.',
      },
    ],
  },
  {
    company: 'sibelco',
    status: 'private',
    ownedBy: 'its founding families, with part of the stock traded on Euronext’s Expert Market',
    holders: [
      {
        name: 'Founding families',
        share: null,
        kind: 'founder',
        asOf: '2023-12-08',
        source: 'https://www.oaklins.com/au/en/deals/109735/',
        note: 'Adviser’s account of the December 2023 tender offer for up to 18.94% of the shares, which Sibelco attributed to “the support of the founding families”.',
      },
    ],
  },
  {
    company: 'shin-etsu-chemical',
    status: 'listed',
    holders: [
      {
        name: 'Nomura Asset Management',
        share: null,
        kind: 'fund',
        asOf: '2026-10-23',
        source:
          'https://uk.marketscreener.com/quote/stock/SHIN-ETSU-CHEMICAL-CO-LTD-6491197/company-shareholders/',
        note: 'Named by a market-data aggregator only; not yet read off the securities report.',
      },
    ],
  },
  {
    company: 'shin-etsu-handotai',
    status: 'subsidiary',
    parent: 'Shin-Etsu Chemical',
    holders: [],
  },
  {
    company: 'jsr',
    status: 'private',
    ownedBy:
      'Japan Investment Corporation, through JICC-02, since the 2024 tender offer and squeeze-out',
    holders: [
      {
        name: 'JIC Capital (JICC-02)',
        share: 100,
        kind: 'state',
        asOf: '2024-06-25',
        source: 'https://www.jsr.co.jp/jsr_e/news/assets/pdf/20240624_01_e.pdf',
        note: 'Delisted from the Tokyo Stock Exchange on 25 June 2024 after the squeeze-out that followed JICC-02’s tender offer; JIC is a Japanese government-backed fund.',
      },
    ],
  },
  {
    company: 'trumpf',
    status: 'private',
    ownedBy: 'the Leibinger family and the Berthold Leibinger Stiftung',
    holders: [
      {
        name: 'Leibinger family',
        share: null,
        kind: 'founder',
        asOf: '2023',
        source: 'https://en.wikipedia.org/wiki/Trumpf',
        note: 'TRUMPF describes itself as a family company; the split with the Berthold Leibinger Stiftung has not been read off the annual report.',
      },
    ],
  },
  {
    company: 'hitachi-energy',
    status: 'subsidiary',
    parent: 'Hitachi',
    holders: [
      {
        name: 'Hitachi',
        share: 100,
        kind: 'strategic',
        asOf: '2022-12',
        source:
          'https://new.abb.com/news/detail/98507/abb-completes-sale-of-remaining-stake-in-hitachi-energy-to-hitachi',
        note: 'Hitachi held 80.1% from the 2020 joint venture and bought ABB’s remaining 19.9% in December 2022.',
      },
    ],
  },
  {
    company: 'sumco',
    status: 'listed',
    holders: [
      {
        name: 'FMR (Fidelity)',
        share: null,
        kind: 'fund',
        asOf: '2026-10-23',
        source: 'https://simplywall.st/stocks/jp/semiconductors/tse-3436/sumco-shares/ownership',
        note: 'Named by a market-data aggregator only; not yet read off the securities report.',
      },
    ],
  },
  {
    company: 'linde',
    status: 'listed',
    holders: [
      {
        name: 'Vanguard',
        share: 9.4,
        kind: 'fund',
        asOf: '2025-04-30',
        source:
          'https://www.sec.gov/Archives/edgar/data/1707925/000095017025060925/lin-20250430.htm',
        note: '2025 proxy statement, principal holders.',
      },
      {
        name: 'BlackRock',
        share: 7.8,
        kind: 'fund',
        asOf: '2025-04-30',
        source:
          'https://www.sec.gov/Archives/edgar/data/1707925/000095017025060925/lin-20250430.htm',
        note: '2025 proxy statement, principal holders.',
      },
      {
        name: 'Capital Group',
        share: 6.0,
        kind: 'fund',
        asOf: '2025-04-30',
        source:
          'https://www.sec.gov/Archives/edgar/data/1707925/000095017025060925/lin-20250430.htm',
        note: '2025 proxy statement, principal holders.',
      },
    ],
  },
];

export const OWNERSHIP = withCandidateHolders(CORPUS_OWNERSHIP, ownershipCandidates);

export function ownershipOf(slug: string): Ownership | undefined {
  return OWNERSHIP.find((o) => o.company === slug);
}
