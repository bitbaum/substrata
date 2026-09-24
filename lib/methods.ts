/**
 * How every computed number on this site is arrived at.
 *
 * A count on a page ("58 bottlenecks", "7/12 sourced") is a function of the
 * corpus, and a reader who wants to check it needs three things: what it
 * counts, the rule it applies, and the code that does it. Before this module
 * those numbers were bare text — true, but uncheckable without reading the
 * source, which made them indistinguishable from the ones that were made up.
 *
 * Each entry here is rendered as an anchor on /data (the method page), and
 * `<Figure method="…">` links a number to it. One definition, used by the
 * number and by the explanation, so the two cannot drift apart.
 *
 * Adding a computed number to a page means adding its method here first.
 */
import { SITE } from './site';

export interface Method {
  /** Short name, as a heading on /data. */
  title: string;
  /** The rule in one line — shown in the popover/tooltip next to the number. */
  formula: string;
  /** What it means and what it does not, for a reader who clicked through. */
  explanation: string;
  /** Repository paths of the code (and data) the number is computed from. */
  code: string[];
}

export const METHODS = {
  'bottleneck-count': {
    title: 'Bottlenecks mapped',
    formula:
      'Count of rows in the bottleneck corpus: every material plus every non-material chokepoint.',
    explanation:
      'Materials and chokepoints (machines, processes, queues) are kept in two files because they are verified differently, and joined into one list. A row is on the list because it was written into the corpus, not because a search found it.',
    code: ['lib/bottlenecks.ts', 'config/substrata.ts', 'config/substrata-coverage.ts'],
  },
  'binding-now': {
    title: 'Binding now',
    formula: 'Count of bottlenecks whose assessed horizon is "now".',
    explanation:
      'The horizon is part of the judged assessment (now, within two years, beyond), not a measurement. It is dated and carries a one-line rationale on every bottleneck page.',
    code: ['lib/bottlenecks.ts', 'config/substrata-assessment.ts'],
  },
  severity: {
    title: 'Severity score (0–12)',
    formula:
      'Sum of four judged scores, each 0–3: concentration + substitution + lead time + inelasticity.',
    explanation:
      'Concentration: how few suppliers qualify. Substitution: how hard it is to replace. Lead time: decision to new capacity. Inelasticity: whether the buyer can walk away. Each is an ordinal judgement written into the corpus with a date and a rationale; the total is not a percentage or a probability, and 8 is not "twice as bad" as 4.',
    code: ['config/substrata-assessment.ts'],
  },
  'producer-rows': {
    title: 'Producer rows',
    formula: 'Count of (bottleneck, producer) pairs across every material in the corpus.',
    explanation:
      'A company that makes two bottlenecked materials is two rows. This counts claims of the form "X produces Y", not companies.',
    code: ['lib/atlas.ts', 'config/substrata-coverage.ts'],
  },
  'sourced-rows': {
    title: 'Sourced, candidate and unverified rows',
    formula:
      'Producer rows counted by verification state: sourced (an accepted primary source is linked), candidate (a source found, not yet reviewed), unverified (neither).',
    explanation:
      'A sourced row establishes the specific claim next to its link (that this company makes this thing). It does not verify the rest of the company profile. Candidate rows have a source found but not yet read; unverified rows have neither.',
    code: ['config/substrata-evidence.ts', 'lib/atlas.ts'],
  },
  organisations: {
    title: 'Organisations',
    formula: 'Count of rows in the market-participant directory.',
    explanation:
      'Every company, lab or agency named anywhere in the corpus. Being listed is not an endorsement and, unless the row says so, not a verified fact about the organisation.',
    code: ['lib/participants.ts', 'config/substrata-participants.ts'],
  },
  'rules-tracked': {
    title: 'Rules tracked',
    formula: 'Count of policy instruments in the corpus; each one links its official text.',
    explanation:
      'An instrument is a law, regulation, export control or programme with an official source and a quoted passage. "Slows building" and "speeds it" are the direction recorded on each row, a judgement about its effect on the bottleneck it names.',
    code: ['config/substrata-policy.ts'],
  },
  'possible-fixes': {
    title: 'Possible fixes',
    formula:
      'Count of science entries: technologies recorded as able to relieve a named bottleneck.',
    explanation:
      'Each entry carries a readiness judgement with its reasoning, and cites a source where one exists. Inclusion means the technology is argued to relieve a constraint, not that it will.',
    code: ['config/substrata-science.ts'],
  },
  'events-window': {
    title: 'Recent events',
    formula: 'Accepted events whose date falls within the last N days of today.',
    explanation:
      'Events are dated observations (capacity, prices, outages, filings) read and accepted by a person, each with its source. Leads found by the automated sweep are not events until accepted.',
    code: ['config/substrata-events.ts'],
  },
  'sweep-candidates': {
    title: 'Candidates awaiting review',
    formula: 'Rows in the sweep worklist whose status is still "candidate".',
    explanation:
      'The automated research sweep proposes leads; this counts the ones nobody has read. They are never shown as findings.',
    code: ['config/substrata-events.ts'],
  },
  'facet-count': {
    title: 'Filter counts',
    formula: 'Count of bottlenecks tagged with that technology, industry or stage.',
    explanation:
      'Tags come from the classification in the corpus. A bottleneck can carry several, so the counts overlap and do not sum to the total.',
    code: ['config/substrata-taxonomy.ts', 'lib/bottlenecks.ts'],
  },
  share: {
    title: 'Share of world output',
    formula: "A place's annual production ÷ the published world total, same unit and year.",
    explanation:
      'Both inputs come from the same source row (USGS Mineral Commodity Summaries unless the row says otherwise). No share is shown when there is no world total in the same unit.',
    code: ['lib/quantities.ts', 'config/substrata-quantities.ts'],
  },
  hhi: {
    title: 'Concentration index (HHI)',
    formula: 'Sum of the squares of each producer’s share of world output (0–1).',
    explanation:
      'The Herfindahl–Hirschman index competition authorities use. 1.0 is a single supplier; 0.1 is a fragmented market. Computed only over producers with a published share, so it can understate concentration when the tail is missing.',
    code: ['lib/quantities.ts'],
  },
  'reserves-to-production': {
    title: 'Reserves-to-production (years)',
    formula: 'Published reserves ÷ annual production, same place, unit and year.',
    explanation:
      '"At today’s rate with today’s reserves" — not a countdown. Reserves are re-estimated as prices and technology move.',
    code: ['lib/quantities.ts'],
  },
} as const satisfies Record<string, Method>;

export type MethodId = keyof typeof METHODS;

export const METHOD_PAGE = '/data';

/** The anchor a method is rendered under on the method page. */
export function methodAnchor(id: MethodId): string {
  return `method-${id}`;
}

export function methodHref(id: MethodId): string {
  return `${METHOD_PAGE}#${methodAnchor(id)}`;
}

/** Where a method's code can be read, on the public repository. */
export function codeHref(path: string): string {
  return `${SITE.repo}/blob/main/${path}`;
}
