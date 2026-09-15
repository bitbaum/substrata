/**
 * Calls: dated predictions that can be wrong.
 *
 * Everything else on this site is description. A call is the one thing that can
 * be scored, and a research project is eventually worth what its past calls
 * were worth. Until 2026-09-15 this project had never made one, which is why
 * the About page said it had no track record.
 *
 * HOW A CALL RELATES TO THE THESIS
 *
 * A thesis claim is a general view — "this decade, energy binds before silicon
 * does" — and general views are almost impossible to resolve. A call is a
 * specific, dated prediction whose outcome bears on one. So every call names
 * the claim it tests, which is what turns six opinions into something that can
 * be marked.
 *
 * THE RULES, WHICH MATTER MORE THAN THE CONTENT
 *
 *   1. Every call names the OBSERVATION that settles it. Not a feeling about
 *      how things are going: something a stranger could check.
 *   2. Every call has a date by which reality must have answered.
 *   3. A call has to be losable. If no informed person would take the other
 *      side, it is a description wearing a prediction's clothes.
 *   4. Resolutions cite the events that settled them, and a wrong call stays on
 *      the page with the same weight as a right one. A track record that hides
 *      its misses is an advertisement.
 *   5. No hit rate is published until enough calls have resolved for one to
 *      mean anything. See `record()`.
 *
 * Created: 2026-09-15
 */

import { INVESTMENT_THESIS } from './substrata-acting';

export type ThesisClaimId = (typeof INVESTMENT_THESIS)[number]['id'];

export type Verdict = 'right' | 'wrong' | 'unclear';

export interface Resolution {
  /** ISO date the call was marked. */
  on: string;
  verdict: Verdict;
  /** Why it resolved that way, in one or two sentences. */
  why: string;
  /** Event ids that settled it. A test refuses an id that does not exist. */
  events: string[];
}

export interface Call {
  id: string;
  /** ISO date published. Git is the proof; this is what renders. */
  madeOn: string;
  /** Specific and dated: one sentence a reader could bet against. */
  claim: string;
  /** Why this project thinks so. */
  reasoning: string;
  /** The general view this bears on. */
  tests: ThesisClaimId;
  /** Coverage rows it is about. */
  bottlenecks: string[];
  /** ISO date by which reality must have answered. */
  resolveBy: string;
  confidence: 'tentative' | 'firm';
  /** The observation that settles it. Checkable by a stranger. */
  settledBy: string;
  resolution: Resolution | null;
}

const MADE = '2026-09-15';

export const CALLS: readonly Call[] = [
  {
    id: 'transformer-lead-times-2027',
    madeOn: MADE,
    claim:
      'Large power transformer lead times will still be three years or longer at the end of 2027, despite the capacity expansions announced through 2026.',
    reasoning:
      'The announced expansions add winding capacity, but the core steel behind them is made on a small number of qualified lines and a new mill takes years. Capital has been available for two years already without shortening the queue, which is the signal that the constraint is not capital.',
    tests: 'energy-binds-first',
    bottlenecks: ['Large power transformer slots', 'Grain-oriented electrical steel (GOES)'],
    resolveBy: '2028-01-31',
    confidence: 'firm',
    settledBy:
      'Quoted lead times for a 100 MVA-class unit from at least two major manufacturers or a published industry survey, dated in the last quarter of 2027.',
    resolution: null,
  },
  {
    id: 'us-interconnection-queues-2028',
    madeOn: MADE,
    claim:
      'Median US interconnection queue duration will not fall below three years by the end of 2028, even though FERC Order No. 2023 took effect in November 2023.',
    reasoning:
      'The reform changes how the queue is processed, not how much transmission exists, and the backlog it inherited is larger than the annual study throughput. If a well-designed process reform cannot clear it, the constraint is physical rather than administrative — which is the more interesting outcome.',
    tests: 'energy-binds-first',
    bottlenecks: ['Grid interconnection queues'],
    resolveBy: '2029-03-31',
    confidence: 'tentative',
    settledBy:
      'The Lawrence Berkeley National Laboratory queued-projects series, or an equivalent published dataset, reporting median duration from request to agreement for projects completing in 2028.',
    resolution: null,
  },
  {
    id: 'heavy-rare-earth-licensing-2027',
    madeOn: MADE,
    claim:
      'China will still require export licences for dysprosium and terbium at the end of 2027, and no non-Chinese source will supply more than a tenth of world heavy rare-earth separation capacity.',
    reasoning:
      'The April 2025 controls made licensing a standing instrument rather than a one-off. Mining is spreading, but separation and metal-making are the concentrated steps and neither is quick to replicate, which is the part most coverage skips.',
    tests: 'concentration-is-political',
    bottlenecks: ['Dysprosium metal', 'Rare-earth magnet sintering'],
    resolveBy: '2028-03-31',
    confidence: 'firm',
    settledBy:
      "China's published control list as it stands at the end of 2027, plus capacity figures from a body such as the US Geological Survey or a named producer's own reporting.",
    resolution: null,
  },
  {
    id: 'hbm-binds-accelerators-2026',
    madeOn: MADE,
    claim:
      'Through 2026, high-bandwidth memory supply rather than leading-edge wafer supply will be the stated limit on AI accelerator shipments.',
    reasoning:
      'This is the clearest test of the claim that the bottleneck sits below where attention is. Coverage treats the foundry as the constraint; the memory stack and the packaging around it are where the recent allocation fights have actually been.',
    tests: 'bottleneck-migrates',
    bottlenecks: ['High-bandwidth memory stacking yield', 'Advanced packaging capacity'],
    resolveBy: '2027-03-31',
    confidence: 'tentative',
    settledBy:
      'Earnings calls or guidance from an accelerator maker or a memory maker naming which of the two limited shipments during 2026.',
    resolution: null,
  },
  {
    id: 'sic-stays-oversupplied-2027',
    madeOn: MADE,
    claim:
      'Silicon carbide substrates will not become a binding constraint before 2028: no sustained shortage, and at least one more Western capacity retrenchment.',
    reasoning:
      'Capacity was built for an automotive demand curve that did not arrive, and a US wafer subsidiary is already being wound up. This is deliberately a call against the site being interesting on this row, and it is the easiest of these to lose if datacentre power conversion moves faster than expected.',
    tests: 'chokepoints-are-not-commodities',
    bottlenecks: ['Silicon carbide substrate, 200 mm semi-insulating'],
    resolveBy: '2028-01-31',
    confidence: 'tentative',
    settledBy:
      'Absence of reported allocation or lead-time extension for 150 mm or 200 mm SiC substrates through 2027, plus at least one further announced closure, sale or capacity cut by a Western maker.',
    resolution: null,
  },
  {
    id: 'neon-does-not-respike-2027',
    madeOn: MADE,
    claim:
      'Neon will not see another supply squeeze of the 2022 kind before 2028, because on-site recycling has structurally cut what a fab needs.',
    reasoning:
      'The 2022 shock triggered recycling and non-Ukrainian separation that did not exist before. If a shortage recurs anyway, then the substitution that was supposed to have relieved it did not, which is the more important finding.',
    tests: 'substitution-is-slow',
    bottlenecks: ['Neon, excimer laser grade'],
    resolveBy: '2028-01-31',
    confidence: 'tentative',
    settledBy:
      'Absence of a reported neon allocation, price spike above roughly three times the 2021 level, or fab output impact attributed to neon, through the end of 2027.',
    resolution: null,
  },
  {
    id: 'polysilicon-232-no-new-electronic-grade',
    madeOn: MADE,
    claim:
      'The US Section 232 action on polysilicon will not add qualified electronic-grade capacity in the United States before 2029, whatever it does to solar-grade supply.',
    reasoning:
      'Electronic-grade polysilicon is a different product from solar-grade and is qualified per customer over years. A tariff changes the price of importing it; it does not shorten a qualification cycle, which is the thing that actually gates supply.',
    tests: 'substitution-is-slow',
    bottlenecks: ['Electronic-grade polysilicon'],
    resolveBy: '2029-06-30',
    confidence: 'firm',
    settledBy:
      'Any announcement by a producer of new US electronic-grade (eleven-nines) polysilicon capacity qualified and shipping to a semiconductor customer before 2029 would settle this against the call.',
    resolution: null,
  },
];

// =====================================================================
// LOOKUPS AND SCORING
// =====================================================================

export const VERDICT_LABEL: Record<Verdict, string> = {
  right: 'Right',
  wrong: 'Wrong',
  unclear: 'Unclear',
};

export const CONFIDENCE_LABEL: Record<Call['confidence'], string> = {
  tentative: 'Tentative',
  firm: 'Firm',
};

/** Open calls, soonest to resolve first — the ones with something at stake. */
export function openCalls(): Call[] {
  return CALLS.filter((c) => c.resolution === null).sort((a, b) =>
    a.resolveBy.localeCompare(b.resolveBy),
  );
}

/** Resolved calls, most recently marked first. */
export function resolvedCalls(): Call[] {
  return CALLS.filter((c) => c.resolution !== null).sort((a, b) =>
    (b.resolution as Resolution).on.localeCompare((a.resolution as Resolution).on),
  );
}

export function callsAbout(bottleneck: string): Call[] {
  return CALLS.filter((c) => c.bottlenecks.includes(bottleneck));
}

export function callsTesting(claim: ThesisClaimId): Call[] {
  return CALLS.filter((c) => c.tests === claim);
}

/** A call is overdue when the date passed and nobody marked it. */
export function isOverdue(call: Call, today = new Date()): boolean {
  return call.resolution === null && call.resolveBy < today.toISOString().slice(0, 10);
}

export interface Record_ {
  total: number;
  open: number;
  right: number;
  wrong: number;
  unclear: number;
  overdue: number;
  /**
   * Whether a hit rate would mean anything yet. Below this many resolved
   * calls, a percentage is noise dressed as a number, and publishing one
   * would be the same failure as the copy this project had to remove.
   */
  enoughToScore: boolean;
}

/** How many resolved calls before a rate is worth printing. */
export const SCORING_THRESHOLD = 10;

export function record(today = new Date()): Record_ {
  const resolved = CALLS.filter((c) => c.resolution !== null);
  return {
    total: CALLS.length,
    open: CALLS.length - resolved.length,
    right: resolved.filter((c) => c.resolution?.verdict === 'right').length,
    wrong: resolved.filter((c) => c.resolution?.verdict === 'wrong').length,
    unclear: resolved.filter((c) => c.resolution?.verdict === 'unclear').length,
    overdue: CALLS.filter((c) => isOverdue(c, today)).length,
    enoughToScore: resolved.length >= SCORING_THRESHOLD,
  };
}
