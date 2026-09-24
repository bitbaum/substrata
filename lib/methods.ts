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
import { SCIENCE_PIPELINE_METHODS } from './methods-science';

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
    code: [
      'lib/bottlenecks.ts',
      'lib/bottlenecks-build.ts',
      'config/substrata.ts',
      'config/substrata-coverage.ts',
    ],
  },
  'binding-now': {
    title: 'Binding now',
    formula: 'Count of bottlenecks whose assessed horizon is "now".',
    explanation:
      'The horizon is part of the judged assessment (now, within two years, beyond), not a measurement. It is dated and carries a one-line rationale on every bottleneck page.',
    code: ['lib/bottlenecks.ts', 'lib/bottlenecks-build.ts', 'config/substrata-assessment.ts'],
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
    code: ['lib/participants.ts', 'lib/participants-build.ts', 'config/substrata-participants.ts'],
  },
  'bottlenecks-held': {
    title: 'Bottlenecks an organisation holds',
    formula:
      'Count of bottlenecks on which this organisation is recorded as a producer, a holder of the capacity, or a supplier of a critical part.',
    explanation:
      'Material rows come from the producer map; machine, process and capacity rows from the holders listed on each chokepoint. A holder row is evidenced by the organisation’s own directory citation. "No other maker recorded" means none in this corpus, which is not the same as none in the world.',
    code: ['lib/company-profile.ts', 'lib/participants-build.ts', 'config/substrata-coverage.ts'],
  },
  'company-events': {
    title: 'Events on an organisation',
    formula:
      'Accepted events that name this organisation, plus (counted separately) accepted events on a bottleneck it holds that do not name it.',
    explanation:
      'Both are read and accepted by a person with a source. The second group is news about what the organisation holds, not about the organisation, and is labelled so on the page.',
    code: ['lib/company-profile.ts', 'config/substrata-events.ts'],
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
    title: 'Leads awaiting review',
    formula:
      'Leads in the research sweep\u2019s queue that no person has read yet, counted live from the database.',
    explanation:
      'The automated sweep proposes leads; this counts the ones nobody has read. They are never shown as findings. The committed worklist file in the repository is an older snapshot of the same queue and is not used for this count.',
    code: ['lib/sweep-store.ts'],
  },
  'review-queue': {
    title: 'Review queue: waiting, oldest, drafts ready',
    formula:
      'Waiting: sweep leads with no reviewer decision. Oldest: whole days since the earliest of them was found. Drafts ready: waiting leads whose AI draft suggests an event and passed the checks.',
    explanation:
      'A draft passes only if its quote occurs word for word on the fetched page and it names bottlenecks and participants the site already has. A ready draft is still unreviewed: it reaches a page only after a person accepts it and the row is committed to the corpus file.',
    code: ['lib/event-draft-store.ts', 'lib/event-draft.ts', 'lib/event-rules.ts'],
  },
  'facet-count': {
    title: 'Filter counts',
    formula: 'Count of bottlenecks tagged with that technology, industry or stage.',
    explanation:
      'Tags come from the classification in the corpus. A bottleneck can carry several, so the counts overlap and do not sum to the total.',
    code: ['config/substrata-taxonomy.ts', 'lib/bottlenecks-build.ts', 'lib/bottlenecks-board.ts'],
  },
  jurisdictions: {
    title: 'Countries',
    formula: 'Number of distinct country codes on the rows being counted (makers, or rules).',
    explanation:
      'A maker row lists the countries it operates in; a rule lists the jurisdiction that issued it. The count is of distinct codes, so a country with ten makers counts once.',
    code: ['lib/bottlenecks.ts', 'config/substrata-policy.ts'],
  },
  'rule-direction': {
    title: 'Rules that slow or speed building',
    formula:
      'Rules counted by the effect recorded on each: "tightens" slows building, "loosens" speeds it; a rule recorded as both ways is counted in neither.',
    explanation:
      'The effect is a judgement about the rule\u2019s effect on the bottleneck it names, written next to the official text and a quoted passage. It is not a claim about the rule\u2019s purpose.',
    code: ['config/substrata-policy.ts'],
  },
  'rules-with-backer': {
    title: 'Rules with a named backer',
    formula:
      'Rules with at least one proponent: an organisation that asked for it in a document linked on the row.',
    explanation:
      'A backer is only recorded when their own words can be linked. Absence means none was found, not that nobody asked.',
    code: ['config/substrata-policy.ts'],
  },
  readiness: {
    title: 'Readiness (1–9)',
    formula:
      'A judged level on a nine-step scale from "idea with a physical basis" (1) to "in production at scale" (9).',
    explanation:
      'Each technology carries its level, the date it was judged, the reasoning, and a source where one exists. 1–4 is "in the lab", 5–7 "being proven", 8–9 "reaching production". It is an ordinal judgement, not a measured maturity.',
    code: ['config/substrata-science.ts'],
  },
  'science-counts': {
    title: 'Science counts',
    formula:
      'Technologies tracked = science entries; bottlenecks addressed = distinct bottlenecks named as relieved by any entry; reaching production = entries judged 8 or 9; sourced = entries whose readiness cites a source.',
    explanation:
      '"Addressed" means an entry argues it would relieve that bottleneck, not that it has. Fronts are the technology tags the entries carry.',
    code: ['config/substrata-science.ts', 'app/science/page.tsx'],
  },
  'capital-counts': {
    title: 'Capital counts',
    formula:
      'Kinds = rows in the capital-kinds list; providers = named funders, each linking its own mandate page; assessed = bottlenecks with a funding judgement; "money is not it" = those judged "not-money".',
    explanation:
      'The funding judgement asks whether more money would loosen the constraint. It is dated, carries its reasoning, and is arguable like every judgement here.',
    code: ['config/substrata-capital.ts'],
  },
  'call-counts': {
    title: 'Calls: open, resolved, overdue, hit rate',
    formula:
      'Open = calls without a resolution; resolved = right + wrong + unclear; overdue = past the resolve-by date and not yet marked; hit rate = right ÷ (right + wrong), published only once enough calls have resolved.',
    explanation:
      'Each call is dated when made and names the observation that settles it. Unclear resolutions are excluded from the hit rate rather than counted either way.',
    code: ['config/substrata-calls.ts'],
  },
  'stage-counts': {
    title: 'Mapped and sourced per stage',
    formula:
      'Bottlenecks on that stage of the loop, and how many of them have every producer row sourced.',
    explanation:
      'A row is "sourced" only when its weakest producer row is. A stage with nothing mapped is a gap in coverage, not a stage without constraints.',
    code: ['lib/atlas.ts', 'config/substrata-stages.ts'],
  },
  'loop-worst': {
    title: 'Worst judgement on a loop',
    formula: 'The highest severity score among the bottlenecks recorded as gates on the loop.',
    explanation:
      'Scores are not added together: a loop is as slow as its worst gate. See the severity method for how each score is made.',
    code: ['lib/kpi/loops.ts'],
  },
  'learn-counts': {
    title: 'Explainers and terms',
    formula: 'Count of explainer files in content/learn, and of entries in the glossary.',
    explanation:
      'Reading time is the word count at 200 words a minute, rounded, with a one-minute minimum (bip-kit readingTime).',
    code: ['app/learn/page.tsx', 'lib/notes.ts', 'config/substrata-glossary.ts'],
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
  'net-pressure': {
    title: 'Net pressure on a bottleneck',
    formula:
      'Accepted events in the last 90 days that tighten it, minus those that loosen it. Neutral events count for neither.',
    explanation:
      'A direction, not a magnitude: one plant closure and one expansion net to zero whatever their sizes. It counts only reviewed events, never unreviewed web leads, so a quiet number can mean nothing happened or that nothing has been reviewed yet.',
    code: ['lib/exposure.ts'],
  },
  'exposure-rows': {
    title: 'Exposure rows',
    formula:
      'One row per (bottleneck, holder) after the screen’s filters; the bottleneck count is the distinct bottlenecks among those rows.',
    explanation:
      'Holders are the producer rows on materials and the recorded makers, capacity holders and part suppliers on chokepoints. A bottleneck with no recorded holder has no row.',
    code: ['lib/exposure.ts', 'lib/exposure-query.ts'],
  },
  'holders-listed': {
    title: 'Holders with a listing',
    formula:
      'Organisations recorded on a bottleneck (maker, capacity holder or part supplier) whose shares, or a parent’s, trade on an exchange found in the SEC ticker file or OpenFIGI.',
    explanation:
      'Listings come from research/listings.json, generated by scripts/research/listings.ts. A parent listing is a diluted exposure: Hitachi Energy trades only as part of Hitachi.',
    code: ['lib/exposure.ts', 'lib/listings.ts', 'scripts/research/listings.ts'],
  },
  ...SCIENCE_PIPELINE_METHODS,
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
