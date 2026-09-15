/**
 * Events: what happened to a bottleneck, dated.
 *
 * An event is one line, one date, one source, and an effect — tightens,
 * loosens or neutral — on the bottlenecks it names. That last field is what
 * makes events useful: a reader filtering the last month by "tightens" on
 * the energy stage gets the answer without reading a headline.
 *
 * This file holds ACCEPTED events: an analyst read the source and wrote the
 * line. The sweep (scripts/research/sweep-events.ts) files candidates into
 * research/events.json and never writes here. Kinds and effects are closed
 * sets, and a test refuses an event that names a bottleneck or participant
 * the universe does not have.
 *
 * Created: 2026-09-15
 */

import eventsWorklist from '../research/events.json';

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
  /** The sentence from the source that carries the claim. */
  quote: string;
  /** The date the analyst accepted it; git carries the rest. */
  acceptedOn: string;
}

/**
 * What the sweep files: a page that mentions a bottleneck's term with the
 * words of a change around it. A worklist entry, never a finding.
 */
export interface CandidateEvent {
  id: string;
  bottleneck: string;
  term: string;
  url: string;
  title: string;
  published: string | null;
  excerpt: string;
  effectGuess: EventEffect;
  foundAt: string;
  status: 'candidate' | 'could_not_look';
}

export interface EventsWorklist {
  version: 1;
  generatedAt: string | null;
  candidates: CandidateEvent[];
}

export const EVENT_WORKLIST: EventsWorklist = eventsWorklist as EventsWorklist;

/** Candidates nobody has read yet. Counted on the site, never listed as findings. */
export function candidatesAwaiting(): number {
  return EVENT_WORKLIST.candidates.filter((c) => c.status === 'candidate').length;
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
    participants: ['SK Siltron CSS'],
    jurisdictions: ['US', 'KR'],
    source: 'https://www.thelec.net/news/articleView.html?idxno=12315',
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
    quote:
      'On March 27, 2026, the European Commission issued a notice initiating a safeguard investigation on grain-oriented electrical steel.',
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
    quote:
      'A move that would free floor space and specialized equipment lines at both sites for the high-bandwidth memory stacking work.',
    acceptedOn: '2026-09-15',
  },
  {
    id: '2026-09-05-tennessee-polysilicon-plant-at-risk',
    date: '2026-09-05',
    headline: 'A polysilicon plant in Tennessee is reported at risk of closure.',
    kind: 'capacity',
    effect: 'tightens',
    bottlenecks: ['Electronic-grade polysilicon'],
    participants: [],
    jurisdictions: ['US'],
    source: 'https://www.arkansasonline.com/news/2026/sep/05/polysilicon-plant-at-risk-of-closure/',
    quote: 'Polysilicon plant in Tennessee at risk of closure. September 5, 2026.',
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
    quote:
      'Shanghai Electric has achieved a milestone in the high-end equipment sector, securing its first overseas heavy-duty gas turbine order.',
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
    quote:
      'The EU control list provides for the addition of new dual-use items, including semiconductor manufacturing and testing equipment and materials (e.g. Atomic Layer Deposition equipment for molybdenum and Ruthenium).',
    acceptedOn: '2026-09-15',
  },
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
