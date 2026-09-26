/**
 * Events: what happened to a bottleneck, dated.
 *
 * An event is one line, one date, one source, and an effect — tightens,
 * loosens or neutral — on the bottlenecks it names. That last field is what
 * makes events useful: a reader filtering the last month by "tightens" on
 * the energy stage gets the answer without reading a headline.
 *
 * This file holds ACCEPTED events: an analyst read the source and wrote the
 * line. The sweep (box timer, lib/sweep-store.ts) files candidates into its
 * one queue, `research_sweep_candidates`, and never writes here. Kinds and effects are closed
 * sets, and a test refuses an event that names a bottleneck or participant
 * the universe does not have.
 *
 * Created: 2026-09-15
 */

// Rows accepted at /review and written by `pnpm run research:accept-events`.
// Same shape, same tests, same rule: they reach a page through a commit.
import reviewedEvents from './substrata-events-accepted.json';

export type EventKind =
  'capacity' | 'lead-time' | 'price' | 'policy' | 'outage' | 'filing' | 'milestone';

export type EventEffect = 'tightens' | 'loosens' | 'neutral';

export interface CoverageEvent {
  /** Stable id: date plus a slug. */
  id: string;
  /** ISO date the thing happened or was announced, not the date we filed it. */
  date: string;
  /** One line, under 120 characters, written by the analyst. */
  headline: string;
  kind: EventKind;
  effect: EventEffect;
  /** Bottleneck names this event bears on. At least one. */
  bottlenecks: string[];
  /** Participant names, where the universe has them. */
  participants: string[];
  /** ISO 3166-1 alpha-2 codes, where the event is geographic. */
  jurisdictions: string[];
  source: string;
  /**
   * Whether that source is the organisation's own page or an official record.
   * A trade-press account of a policy change is useful and is not the same
   * thing as the instrument, and the page says which it is.
   */
  primary: boolean;
  /** The sentence from the source that carries the claim. */
  quote: string;
  /** The date the analyst accepted it; git carries the rest. */
  acceptedOn: string;
}

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  capacity: 'Capacity',
  'lead-time': 'Lead time',
  price: 'Price',
  policy: 'Policy',
  outage: 'Outage',
  filing: 'Filing',
  milestone: 'Milestone',
};

export const EVENT_EFFECT_LABEL: Record<EventEffect, string> = {
  tightens: 'Tightens',
  loosens: 'Loosens',
  neutral: 'Neutral',
};

export const EVENTS: readonly CoverageEvent[] = [
  {
    id: '2025-12-03-coherent-sic-300mm',
    date: '2025-12-03',
    headline:
      'Coherent adds 300 mm capability to its silicon carbide platform, citing AI and datacentre power demand.',
    kind: 'capacity',
    effect: 'loosens',
    bottlenecks: ['Silicon carbide substrate, 200 mm semi-insulating'],
    participants: ['Coherent'],
    jurisdictions: ['US'],
    source:
      'https://www.coherent.com/news/press-releases/Coherent-expands-silicon-carbide-platform-with-300mm-capability-to-support-growing-demand-of-ai-and-datacenters',
    primary: true,
    quote:
      'Coherent expands silicon carbide platform with 300mm capability to support growing demand of AI and datacenters.',
    acceptedOn: '2026-09-15',
  },
  {
    id: '2026-07-17-sk-siltron-css-liquidation',
    date: '2026-07-17',
    headline:
      'SK Siltron is liquidating SK Siltron CSS, its US silicon carbide wafer subsidiary, by year end.',
    kind: 'capacity',
    effect: 'tightens',
    bottlenecks: ['Silicon carbide substrate, 200 mm semi-insulating'],
    participants: ['SK Siltron'],
    jurisdictions: ['US', 'KR'],
    source: 'https://www.thelec.net/news/articleView.html?idxno=12315',
    primary: true,
    quote:
      'SK Siltron is proceeding with the liquidation of SK Siltron CSS, its SiC wafer manufacturing subsidiary located in Michigan. The process is expected to be completed by the end of this year.',
    acceptedOn: '2026-09-15',
  },
  {
    id: '2026-07-28-oci-polysilicon-double',
    date: '2026-07-28',
    headline:
      'OCI Holdings plans to double polysilicon production capacity by 2029 to meet US demand.',
    kind: 'capacity',
    effect: 'loosens',
    bottlenecks: ['Electronic-grade polysilicon'],
    participants: ['OCI'],
    jurisdictions: ['KR', 'MY', 'US'],
    source:
      'https://www.pv-magazine.com/2026/07/28/oci-holdings-plans-to-double-polysilicon-production-capacity-by-2029/',
    primary: true,
    quote: 'OCI Holdings plans to double polysilicon production capacity by 2029.',
    acceptedOn: '2026-09-15',
  },
  {
    id: '2026-08-27-tokuyama-vietnam-polysilicon',
    date: '2026-08-27',
    headline: 'Tokuyama opens a polysilicon factory in Vietnam.',
    kind: 'capacity',
    effect: 'loosens',
    bottlenecks: ['Electronic-grade polysilicon'],
    participants: ['Tokuyama'],
    jurisdictions: ['VN', 'JP'],
    source:
      'https://www.pv-magazine-india.com/2026/08/27/japans-tokuyama-opens-polysilicon-factory-in-vietnam/',
    primary: true,
    quote: "Japan's Tokuyama opens polysilicon factory in Vietnam.",
    acceptedOn: '2026-09-15',
  },
  {
    id: '2022-11-10-tsmc-neon-supply-chain',
    date: '2022-11-10',
    headline:
      'TSMC moves to build a neon supply chain in Taiwan after the war in Ukraine cut global supply.',
    kind: 'capacity',
    effect: 'loosens',
    bottlenecks: ['Neon, excimer laser grade'],
    participants: ['TSMC'],
    jurisdictions: ['TW'],
    source: 'https://www.tomshardware.com/news/tsmc-to-build-neon-supply-chain-in-taiwan',
    primary: true,
    quote: 'TSMC to Build Neon Supply Chain After Russia Decimated Global Supply.',
    acceptedOn: '2026-09-15',
  },
  {
    id: '2026-03-27-eu-goes-safeguard-investigation',
    date: '2026-03-27',
    headline:
      'The European Commission opens a safeguard investigation into imports of grain-oriented electrical steel.',
    kind: 'policy',
    effect: 'tightens',
    bottlenecks: ['Grain-oriented electrical steel (GOES)'],
    participants: [],
    jurisdictions: ['EU'],
    source:
      'https://aslgate.com/european-union-officially-initiates-safeguard-investigation-on-grain-oriented-electrical-steel-goes/',
    primary: true,
    quote:
      'on March 27, 2026, the European Commission issued a notice initiating a safeguard investigation on certain Grain-Oriented Electrical Steel (GOES) products.',
    acceptedOn: '2026-09-15',
  },
  {
    id: '2026-04-15-asml-60-euv-shipments',
    date: '2026-04-15',
    headline:
      'ASML plans to ship more than 60 EUV scanners in 2026, high-NA and low-NA together, on memory demand.',
    kind: 'capacity',
    effect: 'loosens',
    bottlenecks: ['EUV lithography scanners'],
    participants: ['ASML'],
    jurisdictions: ['NL'],
    source:
      'https://www.techpowerup.com/348239/asml-targets-60-euv-shipments-in-2026-as-memory-demand-surges',
    primary: true,
    quote:
      'In the latest Q1 2026 quarterly figures, ASML announced plans to ship over 60 EUV units this year, including both High-NA and Low-NA EUV lithography scanners.',
    acceptedOn: '2026-09-15',
  },
  {
    id: '2026-06-30-quartz-corp-restructures-us',
    date: '2026-06-30',
    headline:
      'The Quartz Corp restructures its US operations, citing persistent losses in its renewable-energy business.',
    kind: 'filing',
    effect: 'neutral',
    bottlenecks: ['Crucible-grade high-purity quartz sand'],
    participants: ['The Quartz Corp'],
    jurisdictions: ['US', 'NO'],
    source: 'https://www.thequartzcorp.com/articles/restructuring-us',
    primary: true,
    quote:
      'The renewable energy industry, a significant business area for The Quartz Corp (TQC), is affected internationally by persistent losses.',
    acceptedOn: '2026-09-15',
  },
  {
    id: '2026-08-15-samsung-backend-to-vietnam-for-hbm',
    date: '2026-08-15',
    headline:
      'Samsung weighs moving legacy memory packaging to Vietnam to free Korean lines for HBM stacking.',
    kind: 'capacity',
    effect: 'loosens',
    bottlenecks: ['High-bandwidth memory stacking yield'],
    participants: ['Samsung Memory'],
    jurisdictions: ['KR', 'VN'],
    source:
      'https://www.techtimes.com/articles/324595/20260815/samsung-weighs-shipping-legacy-memory-backend-vietnam-unlock-hbm-capacity.htm',
    primary: true,
    quote:
      'A move that would free floor space and specialized equipment lines at both sites for the high-bandwidth memory stacking work.',
    acceptedOn: '2026-09-15',
  },
  {
    id: '2026-09-05-wacker-charleston-closure-risk',
    date: '2026-09-05',
    headline:
      'Wacker’s 600-worker Charleston polysilicon plant may close after a US trade measure drove off both its customers.',
    kind: 'capacity',
    effect: 'tightens',
    bottlenecks: ['Electronic-grade polysilicon'],
    participants: ['Wacker Chemie'],
    jurisdictions: ['US', 'DE'],
    source: 'https://www.arkansasonline.com/news/2026/sep/05/polysilicon-plant-at-risk-of-closure/',
    primary: false,
    quote:
      'The move follows a White House proclamation last month that seeks to incentivize purchases of American polysilicon, the sources said, declining to be named because the matter was not public.',
    acceptedOn: '2026-09-15',
  },
  {
    id: '2026-09-13-shanghai-electric-first-overseas-turbine-order',
    date: '2026-09-13',
    headline:
      'Shanghai Electric wins its first overseas heavy-duty gas turbine order, 500 MW in Malaysia.',
    kind: 'milestone',
    effect: 'loosens',
    bottlenecks: ['Heavy-duty gas turbine order books'],
    participants: [],
    jurisdictions: ['CN', 'MY'],
    source:
      'https://www.prnewswire.com/news-releases/shanghai-electric-secures-first-overseas-heavy-duty-gas-turbine-order-for-500-mw-malaysian-project-302876154.html',
    primary: true,
    quote:
      'Shanghai Electric Secures First Overseas Heavy-Duty Gas Turbine Order for 500 MW Malaysian Project / Shanghai Electric (SEHK: 02727, SSE: 601727) has achieved a milestone in the high-end overseas energy sector by securing the contract for Unit 3 of the Sarawak Samalaju Combined Cycle Gas Turbine (CCGT) project in Malaysia.',
    acceptedOn: '2026-09-15',
  },
  {
    id: '2026-09-14-eu-dual-use-list-adds-ru-ald',
    date: '2026-09-14',
    headline:
      'The EU updates its dual-use control list to add atomic layer deposition equipment for molybdenum and ruthenium.',
    kind: 'policy',
    effect: 'tightens',
    bottlenecks: ['Ruthenium, sputtering and ALD grade'],
    participants: [],
    jurisdictions: ['EU'],
    source:
      'https://policy.trade.ec.europa.eu/news/2026-update-eu-control-list-dual-use-items-2026-09-14_en',
    primary: true,
    quote:
      'Specifically, this update of the EU control list provides for the addition of new dual-use items, including: Semiconductor manufacturing and testing equipment and materials (e.g. Atomic Layer Deposition equipment for molybdenum and Ruthenium, equipment for the development and the inspection of Extreme Ultra-Violet masks and reticles, and single wafer cleaning equipment)',
    acceptedOn: '2026-09-15',
  },
  {
    id: '2024-03-26-wolfspeed-siler-city-topping-out',
    date: '2024-03-26',
    headline:
      'Wolfspeed tops out its $5bn silicon carbide materials plant in Siler City, built for 200 mm wafers.',
    kind: 'capacity',
    effect: 'loosens',
    bottlenecks: ['Silicon carbide substrate, 200 mm semi-insulating'],
    participants: ['Wolfspeed'],
    jurisdictions: ['US'],
    source:
      'https://www.wolfspeed.com/company/news-events/news/wolfspeed-tops-out-worlds-largest-most-advanced-silicon-carbide-facility-alongside-senator-thom-tillis-key-officials/',
    primary: true,
    quote:
      'Wolfspeed currently produces more than 60% of the world’s silicon carbide materials at its Durham, N.C. headquarters, and is engaged in a $6.5 billion capacity expansion effort to dramatically increase production.',
    acceptedOn: '2026-09-15',
  },
  {
    id: '2026-09-10-china-november-rare-earth-controls',
    date: '2026-09-10',
    headline:
      'China’s November export controls will test whether rare-earth refining and recycling outside it can scale.',
    kind: 'policy',
    effect: 'tightens',
    bottlenecks: [
      'Dysprosium metal',
      'Didymium (Nd-Pr) metal, magnet feed',
      'Rare-earth magnet sintering',
    ],
    participants: [],
    jurisdictions: ['CN'],
    source:
      'https://www.fastmarkets.com/insights/chinas-looming-november-export-controls-test-rare-earth-refining-recycling-ambitions/',
    primary: false,
    quote:
      'For decades, China has been the dominant supplier of the rare earths required to produce sintered neodymium-iron-boron (NdFeB) magnets: neodymium-praseodymium (NdPr), dysprosium and terbium.',
    acceptedOn: '2026-09-15',
  },
  {
    id: '2026-09-14-arcelormittal-china-oriental-electrical-steel',
    date: '2026-09-14',
    headline:
      'ArcelorMittal and China Oriental open a 1.8 Mt/yr electrical steel joint venture in Changzhou; the first phase is non-oriented.',
    kind: 'capacity',
    effect: 'neutral',
    bottlenecks: ['Grain-oriented electrical steel (GOES)'],
    participants: [],
    jurisdictions: ['CN'],
    source:
      'https://gmk.center/en/news/arcelormittal-and-china-oriental-are-to-produce-electrical-steel-in-china/',
    primary: false,
    quote:
      'The total production capacity of the facility in Changzhou will be 1.8 million tonnes of high-quality electrical steel sheets.',
    acceptedOn: '2026-09-15',
  },
  {
    id: '2026-07-31-semi-q2-wafer-shipments',
    date: '2026-07-31',
    headline:
      'Silicon wafer shipments reached 3,573 million square inches in the second quarter, up 7.4% on the year.',
    kind: 'capacity',
    effect: 'neutral',
    bottlenecks: ['300 mm prime silicon wafers'],
    participants: [],
    jurisdictions: [],
    source: 'https://www.eenewseurope.com/en/semi-reports-7-4-rise-in-silicon-wafer-shipments/',
    primary: false,
    quote:
      'According to the SEMI Silicon Manufacturers Group (SMG), worldwide silicon wafer shipments reached 3,573 million square inches (MSI) in the second quarter of 2026.',
    acceptedOn: '2026-09-15',
  },
  {
    id: '2026-07-30-samsung-taylor-second-fab',
    date: '2026-07-30',
    headline:
      'Samsung brings its first Taylor, Texas fab online and will start a second by year end, warning the shortage runs to 2028.',
    kind: 'capacity',
    effect: 'loosens',
    bottlenecks: ['Leading-edge foundry capacity'],
    participants: ['Samsung Foundry'],
    jurisdictions: ['US', 'KR'],
    source: 'https://www.koreaherald.com/article/10825142',
    primary: false,
    quote:
      'Samsung Electronics is accelerating its US chip expansion, bringing its first Taylor, Texas, foundry online this year and starting construction of a second fab by year-end.',
    acceptedOn: '2026-09-15',
  },
  {
    id: '2026-06-30-quartz-corp-spruce-pine-closure',
    date: '2026-06-30',
    headline:
      'The Quartz Corp indefinitely closes one of its Spruce Pine plants, the most concentrated node in the chain.',
    kind: 'capacity',
    effect: 'tightens',
    bottlenecks: ['Crucible-grade high-purity quartz sand'],
    participants: ['The Quartz Corp'],
    jurisdictions: ['US'],
    source: 'https://www.thequartzcorp.com/articles/restructuring-us',
    primary: true,
    quote:
      'We are stabilizing our operations including the indefinite closure of one quartz production facility located at Altapass Highway in Spruce Pine, NC, U.S. and reducing our workforce by 20-30 people as a result.',
    acceptedOn: '2026-09-15',
  },
  {
    id: '2026-06-14-energy-fuels-dysprosium-terbium',
    date: '2026-06-14',
    headline:
      'Energy Fuels begins converting White Mesa to commercial dysprosium and terbium production from July.',
    kind: 'capacity',
    effect: 'loosens',
    bottlenecks: ['Dysprosium metal'],
    participants: [],
    jurisdictions: ['US'],
    source:
      'https://www.boerse-global.de/energy-fuels-aktie-dysprosium-produktion-ab-juli-2026/797298',
    primary: false,
    quote:
      'Energy Fuels startet im Juli die Umstellung auf die Produktion von Dysprosium und Terbium, während die Uranförderung am unteren Ende der Prognose bleibt.',
    acceptedOn: '2026-09-15',
  },
  {
    id: '2026-04-23-japan-photoresist-solvent-shortage',
    date: '2026-04-23',
    headline:
      'Japanese photoresist makers warn Samsung and SK hynix that the Iran war has cut supply of the solvents the chemistry needs.',
    kind: 'outage',
    effect: 'tightens',
    bottlenecks: ['Photoresist formulation'],
    participants: [],
    jurisdictions: ['JP', 'KR'],
    source: 'https://www.thelec.net/news/articleView.html?idxno=6735',
    primary: false,
    quote:
      'A shortage of key solvents is disrupting production of photoresist and other photolithography materials in Japan.',
    acceptedOn: '2026-09-15',
  },
  {
    id: '2026-03-18-iran-war-helium-shortage',
    date: '2026-03-18',
    headline:
      'The war that began in Iran in February triggers a helium shortage that could slow chip production.',
    kind: 'outage',
    effect: 'tightens',
    bottlenecks: ['Liquid helium (He-4)'],
    participants: [],
    jurisdictions: ['QA', 'IR'],
    source:
      'https://www.dw.com/en/iran-war-helium-semiconductor-industry-chips-oil-qatar-us-evs-smartphones/a-76380869',
    primary: false,
    quote:
      'Among the latest geopolitical uncertainties for the industry is a shortage of helium that could slow global production.',
    acceptedOn: '2026-09-15',
  },
  {
    id: '2025-12-02-nabtesco-rvmini-monocrank',
    date: '2025-12-02',
    headline:
      'Nabtesco launches two compact precision reduction gear series aimed at smaller robot joints.',
    kind: 'milestone',
    effect: 'loosens',
    bottlenecks: ['Precision reduction drives'],
    participants: [],
    jurisdictions: ['JP'],
    source: 'https://www.nabtesco.com/en/news/20251202-17329/',
    primary: true,
    quote:
      'will add two new products to its lineup: the “RVmini® Series,” a compact and lightweight high-precision strain wave generators, and the “Monocrank™ Series,” which achieves high precision and high rigidity despite its compact size.',
    acceptedOn: '2026-09-15',
  },
  {
    id: '2025-11-07-mofcom-suspends-october-package',
    date: '2025-11-07',
    headline:
      'China suspends the export-control package it issued a month earlier, including its gallium measures, until November 2026.',
    kind: 'policy',
    effect: 'loosens',
    bottlenecks: ['Gallium, refined'],
    participants: [],
    jurisdictions: ['CN'],
    source: 'https://www.gvw.com/en/news/blog/detail/china-export-control-update',
    primary: false,
    quote:
      'On November 7, 2025, MOFCOM announced the suspension of the entire package of export controls issued just one month prior.',
    acceptedOn: '2026-09-15',
  },
  ...(reviewedEvents as CoverageEvent[]),
];

/** Newest first. */
export function eventsNewestFirst(): CoverageEvent[] {
  return [...EVENTS].sort((x, y) => y.date.localeCompare(x.date));
}

export function eventsFor(bottleneck: string): CoverageEvent[] {
  return eventsNewestFirst().filter((event) => event.bottlenecks.includes(bottleneck));
}

/** Events dated within the last `days` days of `today` (ISO date). */
export function eventsSince(days: number, today = new Date()): CoverageEvent[] {
  const cutoff = new Date(today.getTime() - days * 86_400_000).toISOString().slice(0, 10);
  return eventsNewestFirst().filter((event) => event.date >= cutoff);
}
