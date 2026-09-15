/**
 * Policy: the rules that loosen or tighten a bottleneck, and who asked for them.
 *
 * Most deliberate slowing of technology happens through rules rather than
 * through physics, so policy is covered here the same way a material is: what
 * the instrument is, which bottleneck it bears on, on what date, from a source
 * you can open, with one verbatim sentence from that source.
 *
 * Three rules this file keeps, because they are what make it trustworthy:
 *
 *   1. A `proponent` is recorded ONLY where a named organisation states the
 *      position itself, in its own release, a filing, testimony or a comment
 *      letter, and the URL is that document. Never inferred from who benefits.
 *      An empty list means "nobody researched yet", and the page says so
 *      rather than implying nobody asked.
 *   2. `status` is what the source says, including when that is inconvenient:
 *      an instrument adopted but not yet in force says adopted, and a measure
 *      reported suspended by secondary sources only says so in `statusNote`.
 *   3. `primary: false` marks a row whose best reachable source was not the
 *      issuing body, and the page shows that too.
 *
 * Every row here was fetched and read on 2026-09-15. Nothing is reconstructed
 * from memory.
 *
 * Created: 2026-09-15
 */

import type { IndustryId, TechnologyId } from './substrata-taxonomy';

export type JurisdictionId = 'us' | 'eu' | 'cn' | 'jp' | 'kr' | 'tw' | 'nl' | 'gb' | 'de' | 'ch';

export type InstrumentKind =
  | 'export-control'
  | 'licence-regime'
  | 'compute-threshold'
  | 'tariff'
  | 'safeguard'
  | 'permit'
  | 'procedure'
  | 'subsidy'
  | 'standard';

export type InstrumentStatus = 'proposed' | 'consulted' | 'adopted' | 'in-force' | 'withdrawn';

/** Which way it moves the constraint: does it make building harder or easier? */
export type InstrumentEffect = 'tightens' | 'loosens' | 'mixed';

export interface Proponent {
  name: string;
  /** What they asked for, in one line, paraphrased from their own words. */
  asked: string;
  /** The document where they say it themselves. */
  source: string;
}

export interface Instrument {
  id: string;
  jurisdiction: JurisdictionId;
  title: string;
  /** The issuing body, as it names itself. */
  body: string;
  kind: InstrumentKind;
  status: InstrumentStatus;
  /** Anything the reader needs to know about the status that the word alone does not carry. */
  statusNote?: string;
  /** ISO date of the instrument itself: published, adopted or signed, as the note explains. */
  date: string;
  effect: InstrumentEffect;
  /** One line: what it does. */
  summary: string;
  technologies: TechnologyId[];
  industries: IndustryId[];
  /** Bottleneck names from the coverage universe. May be empty for a broad rule. */
  bottlenecks: string[];
  source: string;
  /** Whether that source is the issuing body's own page. */
  primary: boolean;
  /** A verbatim sentence from the source. Translated only where the original is not in English. */
  quote: string;
  proponents: Proponent[];
  readOn: string;
}

export interface Jurisdiction {
  id: JurisdictionId;
  name: string;
  /** What this jurisdiction is, for the purposes of this map, in one line. */
  detail: string;
}

export const JURISDICTIONS: readonly Jurisdiction[] = [
  {
    id: 'us',
    name: 'United States',
    detail: 'Sets the export rules most of the chip chain is written against.',
  },
  {
    id: 'eu',
    name: 'European Union',
    detail: 'Trade defence, dual-use controls, and the first broad AI statute.',
  },
  {
    id: 'cn',
    name: 'China',
    detail: 'Holds the refining and magnet steps, and licenses their export.',
  },
  {
    id: 'jp',
    name: 'Japan',
    detail: 'Chemistry and precision machinery the rest of the chain qualifies against.',
  },
  { id: 'kr', name: 'South Korea', detail: 'Memory and wafer capacity.' },
  { id: 'tw', name: 'Taiwan', detail: 'Leading-edge foundry and advanced packaging.' },
  { id: 'nl', name: 'Netherlands', detail: 'The lithography chokepoint sits here.' },
  { id: 'gb', name: 'United Kingdom', detail: 'Research base and grid connection reform.' },
  { id: 'de', name: 'Germany', detail: 'Optics, electrical steel and industrial gases.' },
  { id: 'ch', name: 'Switzerland', detail: 'Where this project is written.' },
];

const READ = '2026-09-15';

export const INSTRUMENTS: readonly Instrument[] = [
  {
    id: 'cn-gallium-germanium-2023',
    jurisdiction: 'cn',
    title:
      'Announcement No. 23 of 2023 on export controls for gallium- and germanium-related items',
    body: 'Ministry of Commerce and General Administration of Customs',
    kind: 'export-control',
    status: 'in-force',
    statusNote:
      'Issued 3 July 2023, in force from 1 August 2023. A licence requirement, not a ban.',
    date: '2023-07-03',
    effect: 'tightens',
    summary:
      'Eight gallium and six germanium item classes may not leave China without an export licence.',
    technologies: ['ai', 'energy', 'space'],
    industries: ['semiconductors', 'mining-materials'],
    bottlenecks: ['Gallium, refined'],
    source: 'https://aqygzj.mofcom.gov.cn/qdml/art/2023/art_c2ae3d2061e14e97ba608de1ed565f78.html',
    primary: true,
    quote:
      '为维护国家安全和利益，经国务院批准，决定对镓、锗相关物项实施出口管制。 (To safeguard national security and interests, with State Council approval, it is decided to implement export controls on gallium- and germanium-related items.)',
    proponents: [],
    readOn: READ,
  },
  {
    id: 'cn-dual-use-to-us-2024',
    jurisdiction: 'cn',
    title:
      'Announcement No. 46 of 2024 on strengthening export controls of dual-use items to the United States',
    body: 'Ministry of Commerce',
    kind: 'export-control',
    status: 'in-force',
    statusNote:
      'In force from 3 December 2024. Secondary reports say these measures were suspended in November 2025 under a US–China agreement; no primary source confirming the suspension was reachable, so the status here is what the original announcement says.',
    date: '2024-12-03',
    effect: 'tightens',
    summary:
      'Bans dual-use exports to US military users, and says licences for gallium, germanium, antimony and superhard materials to the US will in principle not be granted.',
    technologies: ['ai', 'energy'],
    industries: ['semiconductors', 'mining-materials'],
    bottlenecks: ['Gallium, refined'],
    source:
      'https://www.mofcom.gov.cn/zwgk/zcfb/art/2024/art_3d5e990b43424e60828030f58a547b60.html',
    primary: true,
    quote:
      '禁止两用物项对美国军事用户或军事用途出口。原则上不予许可镓、锗、锑、超硬材料相关两用物项对美国出口。 (Export of dual-use items to US military users or for military end-use is prohibited. Licences for gallium, germanium, antimony and superhard dual-use items to the United States will in principle not be granted.)',
    proponents: [],
    readOn: READ,
  },
  {
    id: 'cn-heavy-rare-earths-2025',
    jurisdiction: 'cn',
    title:
      'Announcement No. 18 of 2025 on export control of certain medium and heavy rare-earth items',
    body: 'Ministry of Commerce and General Administration of Customs',
    kind: 'export-control',
    status: 'in-force',
    statusNote: 'Effective on issuance.',
    date: '2025-04-04',
    effect: 'tightens',
    summary:
      'Puts seven rare earths under licence, including dysprosium and terbium — the elements that keep a magnet strong when it gets hot.',
    technologies: ['robotics', 'energy'],
    industries: ['mining-materials', 'machinery'],
    bottlenecks: [
      'Dysprosium metal',
      'Didymium (Nd-Pr) metal, magnet feed',
      'Rare-earth magnet sintering',
    ],
    source:
      'https://english.mofcom.gov.cn/Policies/AnnouncementsOrders/art/2025/art_0dd87cbee7b045bf93fabe6ab2faceee.html',
    primary: true,
    quote:
      'in order to safeguard national security and interests and fulfill international obligations such as non-proliferation, with the approval of the State Council, a decision is made to implement export control on the following items',
    proponents: [],
    readOn: READ,
  },
  {
    id: 'us-bis-advanced-computing-2022',
    jurisdiction: 'us',
    title: 'Additional export controls on advanced computing and semiconductor manufacturing items',
    body: 'Bureau of Industry and Security, Department of Commerce',
    kind: 'export-control',
    status: 'in-force',
    statusNote:
      'Interim final rule, published 13 October 2022, effective 7 October 2022 — which is why it is usually called the October 7 rule.',
    date: '2022-10-13',
    effect: 'tightens',
    summary:
      'The rule that made advanced chips and the machines that make them a controlled export.',
    technologies: ['ai', 'manufacturing'],
    industries: ['semiconductors'],
    bottlenecks: ['Leading-edge foundry capacity', 'EUV lithography scanners'],
    source:
      'https://www.federalregister.gov/documents/2022/10/13/2022-21658/implementation-of-additional-export-controls-certain-advanced-computing-and-semiconductor',
    primary: true,
    quote:
      'BIS is amending the Export Administration Regulations (EAR) to implement necessary controls on advanced computing integrated circuits (ICs), computer commodities that contain such ICs, and certain semiconductor manufacturing items.',
    proponents: [],
    readOn: READ,
  },
  {
    id: 'us-bis-advanced-computing-2023',
    jurisdiction: 'us',
    title: 'October 2023 update to the advanced computing and semiconductor equipment controls',
    body: 'Bureau of Industry and Security, Department of Commerce',
    kind: 'export-control',
    status: 'in-force',
    statusNote:
      'Two interim final rules issued together, published 25 October 2023, effective 17 November 2023.',
    date: '2023-10-25',
    effect: 'tightens',
    summary: 'Closed the routes around the 2022 rule and widened what counts as a controlled chip.',
    technologies: ['ai', 'manufacturing'],
    industries: ['semiconductors'],
    bottlenecks: ['Leading-edge foundry capacity'],
    source:
      'https://www.federalregister.gov/documents/2023/10/25/2023-23055/implementation-of-additional-export-controls-certain-advanced-computing-items-supercomputer-and',
    primary: true,
    quote:
      "These revisions protect U.S. national security interests by further restricting China's ability to obtain critical technologies to modernize its military capabilities in ways that threaten the national security interests of the United States and its allies.",
    proponents: [],
    readOn: READ,
  },
  {
    id: 'us-bis-hbm-2024',
    jurisdiction: 'us',
    title:
      'Foreign-produced direct product rule additions, including controls on high-bandwidth memory',
    body: 'Bureau of Industry and Security, Department of Commerce',
    kind: 'export-control',
    status: 'in-force',
    statusNote: 'Interim final rule, published 5 December 2024, effective 2 December 2024.',
    date: '2024-12-05',
    effect: 'tightens',
    summary:
      'Brought the memory stacks that feed AI accelerators inside the export-control perimeter.',
    technologies: ['ai'],
    industries: ['semiconductors'],
    bottlenecks: ['High-bandwidth memory stacking yield', 'Advanced packaging capacity'],
    source:
      'https://www.federalregister.gov/documents/2024/12/05/2024-28270/foreign-produced-direct-product-rule-additions-and-refinements-to-controls-for-advanced-computing',
    primary: true,
    quote:
      'adding new controls for certain high bandwidth memory important for advanced computing, and clarifying controls on certain software keys that allow for the use of items such as software tools',
    proponents: [],
    readOn: READ,
  },
  {
    id: 'eu-ai-act-2024',
    jurisdiction: 'eu',
    title: 'Artificial Intelligence Act (Regulation (EU) 2024/1689)',
    body: 'European Parliament and Council',
    kind: 'compute-threshold',
    status: 'in-force',
    statusNote:
      'In force since 1 August 2024; the obligations on general-purpose models applied from 2 August 2025. The 10^25 FLOP threshold that presumes systemic risk is Article 51(2); the official register was unreachable behind a bot challenge, so that figure is sourced secondarily and marked below.',
    date: '2024-08-01',
    effect: 'tightens',
    summary:
      'The first broad AI statute. Above a training-compute threshold, a model is presumed to carry systemic risk and additional obligations attach.',
    technologies: ['ai'],
    industries: ['data-centres'],
    bottlenecks: [],
    source: 'https://commission.europa.eu/news-and-media/news/ai-act-enters-force-2024-08-01_en',
    primary: true,
    quote: 'On 1 August 2024, the European Artificial Intelligence Act (AI Act) enters into force.',
    proponents: [],
    readOn: READ,
  },
  {
    id: 'eu-dual-use-list-2026',
    jurisdiction: 'eu',
    title: '2026 update of the EU control list of dual-use items',
    body: 'European Commission, DG Trade and Economic Security',
    kind: 'export-control',
    status: 'adopted',
    statusNote:
      'Adopted 14 September 2026 and NOT yet in force: it enters into force on publication in the Official Journal after a two-month scrutiny period for the Council and Parliament. It transposes 2025 decisions of the Wassenaar Arrangement, Australia Group and Nuclear Suppliers Group rather than being a unilateral EU move.',
    date: '2026-09-14',
    effect: 'tightens',
    summary:
      'Adds chipmaking equipment to the EU control list, including deposition tools for molybdenum and ruthenium and EUV mask inspection.',
    technologies: ['ai', 'manufacturing'],
    industries: ['semiconductors'],
    bottlenecks: ['Ruthenium, sputtering and ALD grade', 'EUV projection optics'],
    source:
      'https://policy.trade.ec.europa.eu/news/2026-update-eu-control-list-dual-use-items-2026-09-14_en',
    primary: true,
    quote:
      'Semiconductor manufacturing and testing equipment and materials (e.g. Atomic Layer Deposition equipment for molybdenum and Ruthenium, equipment for the development and the inspection of Extreme Ultra-Violet masks and reticles, and single wafer cleaning equipment)',
    proponents: [],
    readOn: READ,
  },
  {
    id: 'eu-goes-safeguard-2026',
    jurisdiction: 'eu',
    title: 'Safeguard investigation into imports of grain-oriented electrical steel',
    body: 'European Commission, DG Trade and Economic Security',
    kind: 'safeguard',
    status: 'consulted',
    statusNote:
      'An investigation, not a measure. Provisional measures are possible roughly four to five months in. GOES already carries anti-dumping duties against several origins.',
    date: '2026-03-27',
    effect: 'tightens',
    summary:
      'Opens the question of whether to restrict imports of the steel that goes inside large power transformers.',
    technologies: ['energy'],
    industries: ['power-grid', 'mining-materials'],
    bottlenecks: ['Grain-oriented electrical steel (GOES)'],
    source:
      'https://policy.trade.ec.europa.eu/news/commission-initiates-safeguard-investigation-imports-grain-oriented-electrical-steel-2026-03-27_en',
    primary: true,
    quote:
      'Today, the European Commission initiated an investigation to assess whether safeguard measures are needed for EU manufacturers of grain-oriented electrical sheets (GOES).',
    proponents: [
      {
        name: 'thyssenkrupp Electrical Steel',
        asked:
          'Called publicly for prompt EU trade protection on grain-oriented electrical steel, one day before the investigation opened.',
        source:
          'https://www.thyssenkrupp-steel.com/en/newsroom/press-releases/thyssenkrupp-electrical-steel-extends-production-cuts-at-its-isbergues-site-in-france.html',
      },
    ],
    readOn: READ,
  },
  {
    id: 'us-ferc-order-2023',
    jurisdiction: 'us',
    title: 'Order No. 2023: improvements to generator interconnection procedures and agreements',
    body: 'Federal Energy Regulatory Commission',
    kind: 'procedure',
    status: 'in-force',
    statusNote:
      'Issued 28 July 2023, published 6 September 2023, effective 6 November 2023. A rehearing order followed in 2024.',
    date: '2023-09-06',
    effect: 'loosens',
    summary:
      'Rewrites how new generation joins the US grid: first-ready first-served clusters, deadlines and penalties, aimed squarely at the queue.',
    technologies: ['energy', 'ai'],
    industries: ['power-grid', 'data-centres'],
    bottlenecks: ['Grid interconnection queues'],
    source:
      'https://www.federalregister.gov/documents/2023/09/06/2023-16628/improvements-to-generator-interconnection-procedures-and-agreements',
    primary: true,
    quote:
      'The Commission is adopting reforms to its pro forma Large Generator Interconnection Procedures... to address interconnection queue backlogs, improve certainty, and prevent undue discrimination for new technologies.',
    proponents: [],
    readOn: READ,
  },
  {
    id: 'us-advance-act-2024',
    jurisdiction: 'us',
    title: 'ADVANCE Act of 2024 (Division B of Public Law 118-67)',
    body: '118th Congress',
    kind: 'permit',
    status: 'in-force',
    statusNote:
      'Enacted 9 July 2024. It directs the Nuclear Regulatory Commission — lower licensing fees, hiring, review deadlines — rather than being a regulator’s own rule. Division A of the same law is unrelated.',
    date: '2024-07-09',
    effect: 'loosens',
    summary:
      'Tells the US nuclear regulator to license new reactors faster and more cheaply, which is the slow step for new firm power.',
    technologies: ['energy'],
    industries: ['power-grid', 'data-centres'],
    bottlenecks: [],
    source: 'https://www.govinfo.gov/content/pkg/PLAW-118publ67/html/PLAW-118publ67.htm',
    primary: true,
    quote:
      "This division may be cited as the ``Accelerating Deployment of Versatile, Advanced Nuclear for Clean Energy Act of 2024'' or the ``ADVANCE Act of 2024''.",
    proponents: [],
    readOn: READ,
  },
  {
    id: 'us-section-232-polysilicon-2026',
    jurisdiction: 'us',
    title: 'Proclamation 11052: adjusting imports of polysilicon and its derivatives',
    body: 'Executive Office of the President, on a Section 232 report from the Department of Commerce',
    kind: 'tariff',
    status: 'in-force',
    statusNote:
      'A two-step instrument: Commerce opened the investigation on 1 July 2025; the proclamation was signed 6 August 2026 and published 11 August 2026.',
    date: '2026-08-11',
    effect: 'mixed',
    summary:
      'Treats imported polysilicon as a national-security matter. It protects US production and raises the cost of importing the material every wafer starts from.',
    technologies: ['ai', 'energy'],
    industries: ['semiconductors', 'mining-materials'],
    bottlenecks: ['Electronic-grade polysilicon'],
    source:
      'https://www.federalregister.gov/documents/2026/08/11/2026-16400/adjusting-imports-of-polysilicon-and-its-derivatives-into-the-united-states',
    primary: true,
    quote:
      'the Secretary found and advised me of his opinion that polysilicon and its derivative products are being imported into the United States in such quantities and under such circumstances as to threaten to impair the national security of the United States.',
    proponents: [],
    readOn: READ,
  },
];

/**
 * What Substrata would change, and what would show the suggestion was wrong.
 *
 * These are this project's own view, labelled as such wherever they render.
 * Each names the body that could actually make the change, so it is a
 * proposal rather than a wish.
 */
export interface Recommendation {
  id: string;
  jurisdiction: JurisdictionId;
  /** The body that can actually do it. */
  decider: string;
  change: string;
  because: string;
  expectedEffect: string;
  falsifier: string;
  bottlenecks: string[];
}

export const RECOMMENDATIONS: readonly Recommendation[] = [
  {
    id: 'transformer-standardisation',
    jurisdiction: 'us',
    decider: 'Federal Energy Regulatory Commission and state regulators',
    change:
      'Standardise large power transformer specifications across utilities so orders are interchangeable rather than bespoke.',
    because:
      'A large share of the lead time is that almost every transformer is custom, which stops manufacturers from building to stock and makes a cancelled order worthless to the next buyer.',
    expectedEffect:
      'Shorter effective lead times without new factories, because a standard unit can be built before it is sold.',
    falsifier:
      'Lead times staying above three years in markets that have standardised, which would mean the constraint is core steel and winding capacity rather than specification churn.',
    bottlenecks: ['Large power transformer slots', 'Grain-oriented electrical steel (GOES)'],
  },
  {
    id: 'interconnection-deadlines-with-teeth',
    jurisdiction: 'eu',
    decider: 'European Commission and national transmission regulators',
    change:
      'Adopt the first-ready first-served cluster study approach with binding study deadlines, as the United States did in 2023.',
    because:
      'Speculative applications clog a queue that is processed one project at a time, and a datacentre with a signed site still waits years for a connection date.',
    expectedEffect: 'Queue times falling toward the study deadline rather than the backlog length.',
    falsifier:
      'US queue times not falling in the years after Order No. 2023, which would suggest the reform addresses the wrong step.',
    bottlenecks: ['Grid interconnection queues'],
  },
  {
    id: 'qualification-reciprocity',
    jurisdiction: 'eu',
    decider: 'European Commission, with standards bodies',
    change:
      'Fund and recognise shared qualification testbeds for second-source materials, so a grade qualified once is accepted across more buyers.',
    because:
      'Qualification is per process, per factory, per application, which is why a substitute that exists in a laboratory does not relieve a shortage for years.',
    expectedEffect:
      'Second sources reaching production in quarters rather than years, which is the single largest lever on materials-stage relief time.',
    falsifier:
      'Shared testbeds existing and qualification cycles staying at multi-year length anyway, which would mean the delay is buyer risk appetite rather than test capacity.',
    bottlenecks: [
      'Neon, excimer laser grade',
      'Photoresist formulation',
      'Crucible-grade high-purity quartz sand',
    ],
  },
];

// =====================================================================
// LOOKUPS
// =====================================================================

export const JURISDICTION_LABEL: Record<JurisdictionId, string> = Object.fromEntries(
  JURISDICTIONS.map((j) => [j.id, j.name]),
) as Record<JurisdictionId, string>;

export const INSTRUMENT_KIND_LABEL: Record<InstrumentKind, string> = {
  'export-control': 'Export control',
  'licence-regime': 'Licence regime',
  'compute-threshold': 'Compute threshold',
  tariff: 'Tariff',
  safeguard: 'Trade safeguard',
  permit: 'Permitting',
  procedure: 'Process reform',
  subsidy: 'Subsidy',
  standard: 'Standard',
};

export const INSTRUMENT_STATUS_LABEL: Record<InstrumentStatus, string> = {
  proposed: 'Proposed',
  consulted: 'Under investigation',
  adopted: 'Adopted, not yet in force',
  'in-force': 'In force',
  withdrawn: 'Withdrawn',
};

export const INSTRUMENT_EFFECT_LABEL: Record<InstrumentEffect, string> = {
  tightens: 'Slows building',
  loosens: 'Speeds building',
  mixed: 'Both ways',
};

/** Newest first. */
export function instrumentsNewestFirst(): Instrument[] {
  return [...INSTRUMENTS].sort((a, b) => b.date.localeCompare(a.date));
}

export function instrumentsFor(bottleneck: string): Instrument[] {
  return instrumentsNewestFirst().filter((i) => i.bottlenecks.includes(bottleneck));
}

export function instrumentsIn(jurisdiction: JurisdictionId): Instrument[] {
  return instrumentsNewestFirst().filter((i) => i.jurisdiction === jurisdiction);
}

export function recommendationsIn(jurisdiction: JurisdictionId): Recommendation[] {
  return RECOMMENDATIONS.filter((r) => r.jurisdiction === jurisdiction);
}

export interface PolicyTotals {
  instruments: number;
  tightening: number;
  loosening: number;
  withProponents: number;
  jurisdictions: number;
}

export function policyTotals(): PolicyTotals {
  return {
    instruments: INSTRUMENTS.length,
    tightening: INSTRUMENTS.filter((i) => i.effect === 'tightens').length,
    loosening: INSTRUMENTS.filter((i) => i.effect === 'loosens').length,
    withProponents: INSTRUMENTS.filter((i) => i.proponents.length > 0).length,
    jurisdictions: new Set(INSTRUMENTS.map((i) => i.jurisdiction)).size,
  };
}
