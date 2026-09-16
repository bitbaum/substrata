/**
 * Capital: who can fund relief for a bottleneck, and when money is not the
 * problem at all.
 *
 * THE CLAIM THIS SECTION IS BUILT ON
 *
 * The obvious version of a capital section implies money is the scarce thing.
 * This site's own research says otherwise, and a published call rests on it:
 * large power transformer lead times stay long *because* capital has been
 * available for two years without shortening the queue. A section implying
 * funding is the constraint would contradict the page next to it.
 *
 * So the claim is narrower and more useful: **capital is rarely scarce;
 * capital with the right mandate and the right time horizon is.** A pension
 * fund cannot underwrite a fifteen-year fab. An export credit agency does what
 * private credit will not. A grant programme can pay for a thing that will
 * never return its cost. Those differences decide what actually gets built,
 * and almost nobody maps them.
 *
 * WHAT THIS SECTION IS NOT
 *
 * It is not investment advice and it is not a list of things to buy. It maps
 * who funds what, on whose mandate, on what horizon. Nothing here says where
 * to put money, and the page says so.
 *
 * Scope is bounded to capital that could move a bottleneck under coverage.
 * "Every provider of every kind of capital" is the financial system.
 *
 * Created: 2026-09-15
 */

import type { JurisdictionId } from './substrata-policy';

export type CapitalKindId =
  | 'venture'
  | 'growth'
  | 'project-finance'
  | 'public-markets'
  | 'corporate'
  | 'sovereign'
  | 'government-grant'
  | 'export-credit'
  | 'development-bank'
  | 'offtake';

export interface CapitalKind {
  id: CapitalKindId;
  name: string;
  /** What it is, for someone who has never raised money. */
  plain: string;
  /** Typical size, in words rather than a false precision. */
  chequeSize: string;
  /** How long it will wait before it wants its money back. */
  horizon: string;
  willFund: string;
  /**
   * The structural limit. This is the field that carries the section: what a
   * kind of capital *cannot* do is why some bottlenecks stay unfunded even
   * when the world is awash with money.
   */
  willNotFund: string;
}

export const CAPITAL_KINDS: readonly CapitalKind[] = [
  {
    id: 'venture',
    name: 'Venture capital',
    plain:
      'Money for young companies, in exchange for a share of them, accepting that most will fail.',
    chequeSize: 'Hundreds of thousands to tens of millions',
    horizon: 'Seven to ten years, and it must exit',
    willFund: 'A new approach that could be very large if it works, before there is any revenue.',
    willNotFund:
      'A factory. Venture returns depend on a small number of enormous outcomes, and a plant that earns a steady margin on a known product cannot produce one — however badly the world needs the plant.',
  },
  {
    id: 'growth',
    name: 'Growth equity',
    plain: 'Money for a company that already works and wants to get bigger faster.',
    chequeSize: 'Tens to low hundreds of millions',
    horizon: 'Four to seven years',
    willFund: 'Scaling something already selling, where the risk is execution rather than physics.',
    willNotFund:
      'First-of-a-kind plant risk. If nobody has built this exact thing before, the return cannot be underwritten on comparable companies, which is what this kind of capital is good at.',
  },
  {
    id: 'project-finance',
    name: 'Project finance',
    plain:
      'A loan secured against one specific asset and the money it will earn, rather than against the company that builds it.',
    chequeSize: 'Hundreds of millions to billions',
    horizon: 'Fifteen to thirty years',
    willFund:
      'An asset with contracted revenue: a power plant with a signed offtake, a transmission line with a regulated return.',
    willNotFund:
      'Anything without a bankable contract. This is the largest pool available to heavy industry and it is also the fussiest — no offtake, no loan, whatever the strategic case.',
  },
  {
    id: 'public-markets',
    name: 'Public markets',
    plain: 'Shares and bonds anyone can buy, priced continuously by whoever is trading them.',
    chequeSize: 'Millions to billions',
    horizon: 'As long as the holder likes, and it can leave tomorrow',
    willFund: 'An established company with reported results.',
    willNotFund:
      'A decade of losses without a story that survives quarterly scrutiny. The capital is patient only as long as its holders individually are, which is not the same thing.',
  },
  {
    id: 'corporate',
    name: 'Corporate balance sheet',
    plain: 'A large company spending its own cash on its own capacity.',
    chequeSize: 'Millions to tens of billions',
    horizon: 'As long as the board tolerates',
    willFund:
      'Capacity for a product the company already sells, when it believes demand is coming.',
    willNotFund:
      'Capacity for a competitor, or a shared facility that would help the whole industry. This is the single largest source of funding for the chains on this site and the most reluctant to build anything it cannot keep.',
  },
  {
    id: 'sovereign',
    name: 'Sovereign wealth',
    plain: 'A state investing a surplus, usually from resources, on behalf of a country.',
    chequeSize: 'Hundreds of millions to tens of billions',
    horizon: 'Decades, and no forced exit',
    willFund: 'Very large, very long assets, including ones a private fund could not hold.',
    willNotFund:
      'Anything politically awkward at home. The horizon is the best available anywhere; the constraint is mandate, not time.',
  },
  {
    id: 'government-grant',
    name: 'Government grant and subsidy',
    plain: 'Public money given, not lent, to make something happen that otherwise would not.',
    chequeSize: 'Millions to billions',
    horizon: 'Not applicable — it is not expecting repayment',
    willFund: 'A thing with a public benefit that no private return would justify.',
    willNotFund:
      'Reliably or quickly. It moves on political cycles, arrives with conditions, and can be withdrawn — which is why it is a poor foundation for a fifteen-year build even when it is generous.',
  },
  {
    id: 'export-credit',
    name: 'Export credit',
    plain:
      'A state agency lending or guaranteeing, so that a buyer abroad can afford to buy from that country’s exporters.',
    chequeSize: 'Tens of millions to billions',
    horizon: 'Ten to twenty years',
    willFund:
      'Cross-border industrial projects that commercial banks will not touch, when domestic exporters benefit.',
    willNotFund:
      'A project with no domestic content. The money follows the exporter, not the need, which is why it can build a plant on one continent and never on another.',
  },
  {
    id: 'development-bank',
    name: 'Development bank',
    plain: 'A bank owned by governments, lending for things judged to be in the public interest.',
    chequeSize: 'Tens of millions to billions',
    horizon: 'Fifteen to twenty-five years',
    willFund: 'Infrastructure and industrial capacity that meets a policy objective.',
    willNotFund:
      'Anything outside its mandate, however commercially sound. It is patient and cheap and narrow, in that order.',
  },
  {
    id: 'offtake',
    name: 'Offtake and prepayment',
    plain:
      'A buyer paying in advance, or committing to buy for years, so the producer can raise the money to build.',
    chequeSize: 'Tens of millions to billions',
    horizon: 'Five to fifteen years',
    willFund:
      'New supply of something the buyer genuinely needs and cannot otherwise secure. It is the mechanism that actually unlocks project finance.',
    willNotFund:
      'Anything the buyer could simply purchase on the market. It appears exactly when a buyer becomes frightened about supply, which makes it a useful signal in itself.',
  },
];

// ---------------------------------------------------------------------------
// PROVIDERS — named, and sourced to their own mandate
// ---------------------------------------------------------------------------

export interface CapitalProvider {
  id: string;
  name: string;
  kind: CapitalKindId;
  jurisdiction: JurisdictionId;
  /** What it exists to do, from its own document. */
  mandate: string;
  /** Bottleneck names it could actually fund relief for. */
  canMove: string[];
  source: string;
  /** Whether that source is the organisation's own page. */
  primary: boolean;
  quote: string;
  readOn: string;
}

const READ = '2026-09-15';

/**
 * Three, not five.
 *
 * The first draft of this list had the CHIPS Program Office and JBIC in it,
 * with mandate sentences written from memory. Fetching their pages showed the
 * quotes did not exist: JBIC's role URL 404s and the NIST CHIPS page carries
 * navigation rather than a mandate statement. Two of the three that survived
 * had to be corrected as well — the EIB calls itself "one of the biggest"
 * multilateral institutions and this file had said "the world's largest".
 *
 * So they are out until a real sentence can be found, and this is why the bar
 * is "the organisation's own document" rather than "what everyone knows".
 */
export const CAPITAL_PROVIDERS: readonly CapitalProvider[] = [
  {
    id: 'us-doe-loan-programs-office',
    name: 'Department of Energy Loan Programs Office',
    kind: 'development-bank',
    jurisdiction: 'us',
    mandate:
      'Lends at scale to energy projects that commercial lenders will not finance alone. It now operates as the Office of Energy Dominance Financing, under the authorities the Energy Policy Act of 2005 gave it.',
    canMove: [
      'Large power transformer slots',
      'High-voltage cable and switchgear',
      'Grid interconnection queues',
    ],
    source: 'https://www.energy.gov/lpo/loan-programs-office',
    primary: true,
    quote:
      'Loan Programs Office (LPO) operates as the Office of Energy Dominance Financing (EDF) and performs the duties assigned to LPO through the Energy Policy Act of 2005, as amended.',
    readOn: READ,
  },
  {
    id: 'eu-eib',
    name: 'European Investment Bank',
    kind: 'development-bank',
    jurisdiction: 'eu',
    mandate:
      'The EU’s own bank, lending long-term for infrastructure, energy networks and industrial capacity that meets EU policy objectives.',
    canMove: [
      'High-voltage cable and switchgear',
      'Grain-oriented electrical steel (GOES)',
      'REBCO superconducting tape, 12 mm',
    ],
    source: 'https://www.eib.org/en/about/index.htm',
    primary: true,
    quote:
      'The European Investment Bank is the lending arm of the European Union. We are one of the biggest multilateral financial institutions in the world and one of the largest providers of climate finance.',
    readOn: READ,
  },
  {
    id: 'de-kfw',
    name: 'KfW',
    kind: 'development-bank',
    jurisdiction: 'de',
    mandate:
      'Germany’s promotional bank, funding industrial transformation and energy infrastructure on behalf of the federal government.',
    canMove: ['Grain-oriented electrical steel (GOES)', 'High-voltage cable and switchgear'],
    source: 'https://www.kfw.de/About-KfW/',
    primary: true,
    quote:
      'KfW is one of the world’s leading promotional banks. KfW has been committed to improving economic, social and environmental living conditions across the globe on behalf of the Federal Republic of Germany.',
    readOn: READ,
  },
  {
    id: 'jp-jbic',
    name: 'Japan Bank for International Cooperation',
    kind: 'export-credit',
    jurisdiction: 'jp',
    mandate:
      'Japan’s policy-based financial institution: lending, investment and guarantees that sit beside private banks rather than instead of them.',
    canMove: [
      'Electronic-grade polysilicon',
      '300 mm prime silicon wafers',
      'High-voltage cable and switchgear',
    ],
    source: 'https://www.jbic.go.jp/en/about/role-function.html',
    primary: true,
    quote:
      'JBIC is a policy-based financial institution of Japan, and conducts lending, investment and guarantee operations while complementing the private sector financial institutions.',
    readOn: '2026-09-16',
  },
];

// ---------------------------------------------------------------------------
// IS MONEY ACTUALLY THE CONSTRAINT?
// ---------------------------------------------------------------------------

/**
 * The honest answer for most rows is no, and saying so is the point of the
 * section. A reader who assumes funding fixes a shortage is the reader this
 * table is written for.
 */
export type FundingConstraint = 'not-money' | 'partly-money' | 'money';

export interface FundingAssessment {
  bottleneck: string;
  constraint: FundingConstraint;
  /** The reasoning. Arguable, like every judgement on this site. */
  why: string;
  judgedOn: string;
}

export const FUNDING_ASSESSMENTS: readonly FundingAssessment[] = [
  {
    bottleneck: 'Large power transformer slots',
    constraint: 'not-money',
    why: 'Capital has been available for two years without shortening the queue. What binds is qualified winding capacity, core steel, and the fact that almost every unit is custom — none of which a cheque shortens.',
    judgedOn: READ,
  },
  {
    bottleneck: 'Grid interconnection queues',
    constraint: 'not-money',
    why: 'An administrative queue. There is nothing to buy. Money can fund the transmission that shortens it eventually, but the queue itself is a process, and process is relieved by rules.',
    judgedOn: READ,
  },
  {
    bottleneck: 'EUV lithography scanners',
    constraint: 'not-money',
    why: 'One supplier, sold out, and the buyers are the most cash-rich companies on earth. Every marginal dollar is already bidding for the same machines.',
    judgedOn: READ,
  },
  {
    bottleneck: 'Semiconductor process engineers',
    constraint: 'not-money',
    why: 'Money raises salaries, which moves people between employers without creating any. The constraint is years of experience, and there is no market in that.',
    judgedOn: READ,
  },
  {
    bottleneck: 'Crucible-grade high-purity quartz sand',
    constraint: 'partly-money',
    why: 'Funding could develop a second deposit or a synthetic route, and neither is currently attractive at the price the material commands. The geology is fixed; the willingness to pay for an alternative is not.',
    judgedOn: READ,
  },
  {
    bottleneck: 'Grain-oriented electrical steel (GOES)',
    constraint: 'partly-money',
    why: 'A new mill is buildable and expensive, and the reason few are built is that demand is thought temporary. That is a capital judgement, so capital could change it — slowly.',
    judgedOn: READ,
  },
  {
    bottleneck: 'REBCO superconducting tape, 12 mm',
    constraint: 'money',
    why: 'Production lines are small and the makers are young companies. This is one of the few rows where writing a cheque genuinely adds capacity, which is why fusion programmes have been buying equity in their own suppliers.',
    judgedOn: READ,
  },
  {
    bottleneck: 'Dysprosium metal',
    constraint: 'partly-money',
    why: 'Mining is fundable and spreading. Separation and metal-making are where the concentration is, and those need capital plus a buyer willing to sign a long contract at above the Chinese price.',
    judgedOn: READ,
  },
  {
    bottleneck: 'Electronic-grade polysilicon',
    constraint: 'not-money',
    why: 'A US plant is at risk of closing because a trade measure drove its customers away. Capacity is not short of funding; it is short of buyers.',
    judgedOn: READ,
  },
  {
    bottleneck: 'Silicon carbide substrate, 200 mm semi-insulating',
    constraint: 'not-money',
    why: 'Capacity was built ahead of demand that did not arrive, and a maker has been through Chapter 11. More money would make the oversupply worse.',
    judgedOn: READ,
  },
];

// ---------------------------------------------------------------------------
// LOOKUPS
// ---------------------------------------------------------------------------

export const CAPITAL_KIND_LABEL: Record<CapitalKindId, string> = Object.fromEntries(
  CAPITAL_KINDS.map((k) => [k.id, k.name]),
) as Record<CapitalKindId, string>;

export const CONSTRAINT_LABEL: Record<FundingConstraint, string> = {
  'not-money': 'Money is not the constraint',
  'partly-money': 'Money is part of it',
  money: 'Money would genuinely help',
};

export function kindById(id: CapitalKindId): CapitalKind {
  const found = CAPITAL_KINDS.find((k) => k.id === id);
  if (!found) throw new Error(`Unknown capital kind: ${id}`);
  return found;
}

export function providerById(id: string): CapitalProvider | undefined {
  return CAPITAL_PROVIDERS.find((p) => p.id === id);
}

/** Who could fund relief for this bottleneck. */
export function providersFor(bottleneck: string): CapitalProvider[] {
  return CAPITAL_PROVIDERS.filter((p) => p.canMove.includes(bottleneck));
}

export function fundingFor(bottleneck: string): FundingAssessment | undefined {
  return FUNDING_ASSESSMENTS.find((a) => a.bottleneck === bottleneck);
}

export interface CapitalTotals {
  kinds: number;
  providers: number;
  assessed: number;
  notMoney: number;
}

export function capitalTotals(): CapitalTotals {
  return {
    kinds: CAPITAL_KINDS.length,
    providers: CAPITAL_PROVIDERS.length,
    assessed: FUNDING_ASSESSMENTS.length,
    notMoney: FUNDING_ASSESSMENTS.filter((a) => a.constraint === 'not-money').length,
  };
}
