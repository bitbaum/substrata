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
