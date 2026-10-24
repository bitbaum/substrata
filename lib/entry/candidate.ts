/**
 * A candidate row: what a cheaper model may add to the corpus, and how a
 * config module folds it in.
 *
 * Config stays TypeScript and a cheap model never edits it. It writes JSON for
 * `scripts/research/add.ts`, which validates the row (lib/entry/schemas.ts),
 * reads the source page, checks the quote is on it, and appends the row to
 * `config/candidates/<facet>.json`. Each config module includes its sidecar
 * the way `substrata-events.ts` includes `substrata-events-accepted.json`, so
 * a candidate reaches a page through a commit and nothing else.
 *
 * Every candidate carries `evidence: 'candidate'` — this file's types cannot
 * say `sourced`; only promotion into the TS config writes that word — one
 * source object (url, the verbatim quote, the date it was read), `asOf` (the
 * date the fact is FOR) and who submitted it. Readers already render
 * `candidate` as "Candidate source" (config/substrata-evidence.ts).
 *
 * This file has no runtime import from config/: it is what config/ imports.
 * The schemas, which do need the vocabularies, live in ./schemas.ts.
 *
 * Decided: docs/architecture/2026-10-23-knowledge-system.md, §3.
 */
import type { CoverageEvent } from '@/config/substrata-events';
import type { MaterialCoverage, Producer } from '@/config/substrata-coverage';
import type { Endowment } from '@/config/substrata-quantities';
import type { Facility } from '@/config/substrata-facilities';
import type { Instrument } from '@/config/substrata-policy';
import type { ScienceEntry } from '@/config/substrata-science';
import type { Holder, Ownership } from '@/config/substrata-ownership';
import type { Series, SeriesPoint } from '@/lib/series';
import type { Relation } from '@/lib/graph/types';
import { relationId } from '@/lib/graph/id';

export interface CandidateSource {
  url: string;
  /** Copied verbatim from the page at `url`; the gate refuses a paraphrase. */
  quote: string;
  /** YYYY-MM-DD, the day the page was read. */
  readOn: string;
  /** Where in the source: "page 17" of a PDF, a table and row. */
  locator?: string;
}

/** Which source adapter (lib/sources) proposed the row, from which fetch, and when. */
export interface Provenance {
  adapter: string;
  /** ISO timestamp of the fetch. */
  fetchedAt: string;
  url: string;
}

export interface SubmittedBy {
  agent: string;
  model: string;
  runId: string;
}

export interface CandidateCommon {
  evidence: 'candidate';
  /** The date the fact is FOR — a figure's year-end, an event's day, a filing's as-of. */
  asOf: string;
  source: CandidateSource;
  submittedBy: SubmittedBy;
  /** Present on every row a source adapter made; absent on a hand-written one. */
  provenance?: Provenance;
}

/**
 * The config row's own evidence fields, which the candidate's one `source`
 * object replaces. Folding a candidate into its row fills them back in.
 */
type Replaced = 'source' | 'readOn' | 'quote' | 'acceptedOn' | 'judgedOn' | 'evidence';

/** A facet's candidate: its config row minus the replaced fields, plus the common part. */
export type CandidateOf<Row, Extra = unknown> = Omit<Row, Replaced> & Extra & CandidateCommon;

/** A config row that came from the sidecar, so a reader can say so. */
export type Flagged<Row> = Row & { evidence: 'candidate' };

export type ProducerCandidate = CandidateOf<Producer, { material: string }>;
export type EventCandidate = CandidateOf<CoverageEvent>;
export type EndowmentCandidate = CandidateOf<Endowment>;
export type FacilityCandidate = CandidateOf<Facility>;
export type InstrumentCandidate = CandidateOf<Instrument>;
export type ScienceCandidate = CandidateOf<ScienceEntry>;
export type OwnershipCandidate = CandidateOf<
  Holder,
  Pick<Ownership, 'company' | 'status' | 'parent' | 'ownedBy'>
>;
export type SeriesPointCandidate = CandidateOf<SeriesPoint, { series: string }>;
/**
 * A relation from one source: `stated` when the quote says it, `lead` when it
 * only suggests it. `corroborated` is earned by a second source in the store,
 * and `derived` is written by a rule, never by hand.
 */
export type RelationCandidate = Pick<Relation, 'from' | 'to' | 'type' | 'share' | 'volume'> & {
  grade: 'stated' | 'lead';
  /** For the reviewer: what a figure measures, or why the row is a lead. */
  note?: string;
} & CandidateCommon;

export const FACETS = [
  'producers',
  'events',
  'endowments',
  'facilities',
  'instruments',
  'science',
  'ownership',
  'series-points',
  'relations',
] as const;

export type Facet = (typeof FACETS)[number];

export function isFacet(name: string): name is Facet {
  return (FACETS as readonly string[]).includes(name);
}

/** The sidecar's rows, as read from JSON. The test gate proves the shape; this only narrows the type. */
export function sidecarRows<T>(json: unknown): T[] {
  if (!Array.isArray(json)) throw new Error('A candidates sidecar is a JSON array.');
  return json as T[];
}

/** A copy of `row` without `keys`. */
function omit<T extends object, K extends keyof T>(row: T, keys: readonly K[]): Omit<T, K> {
  const copy: Partial<T> = { ...row };
  for (const key of keys) delete copy[key];
  return copy as Omit<T, K>;
}

const COMMON = ['evidence', 'asOf', 'source', 'submittedBy', 'provenance'] as const;

/** Everything but the common part, which each fold below rewrites into the row's own fields. */
function rowPart<T extends CandidateCommon>(c: T): Omit<T, keyof CandidateCommon> {
  return omit(c, COMMON);
}

export function producerFromCandidate(c: ProducerCandidate): Flagged<Producer> {
  const row = omit(rowPart(c), ['material']);
  return { ...row, source: c.source.url, evidence: 'candidate' };
}

/** Candidate producers appended to their material's entry; a material the universe lacks fails the build. */
export function withCandidateProducers(
  coverage: readonly MaterialCoverage[],
  sidecar: unknown,
): MaterialCoverage[] {
  const candidates = sidecarRows<ProducerCandidate>(sidecar);
  const byMaterial = new Map(
    coverage.map((entry) => [entry.material, { ...entry, producers: [...entry.producers] }]),
  );
  for (const c of candidates) {
    const entry = byMaterial.get(c.material);
    if (!entry)
      throw new Error(
        `config/candidates/producers.json names material "${c.material}", which is not under coverage`,
      );
    entry.producers.push(producerFromCandidate(c));
  }
  return [...byMaterial.values()];
}

export function eventFromCandidate(c: EventCandidate): Flagged<CoverageEvent> {
  return {
    ...rowPart(c),
    source: c.source.url,
    quote: c.source.quote,
    acceptedOn: c.source.readOn,
    evidence: 'candidate',
  };
}

export function endowmentFromCandidate(c: EndowmentCandidate): Flagged<Endowment> {
  return { ...rowPart(c), source: c.source.url, readOn: c.source.readOn, evidence: 'candidate' };
}

export function facilityFromCandidate(c: FacilityCandidate): Flagged<Facility> {
  return { ...rowPart(c), source: c.source.url, readOn: c.source.readOn, evidence: 'candidate' };
}

export function instrumentFromCandidate(c: InstrumentCandidate): Flagged<Instrument> {
  return {
    ...rowPart(c),
    source: c.source.url,
    quote: c.source.quote,
    readOn: c.source.readOn,
    evidence: 'candidate',
  };
}

export function scienceFromCandidate(c: ScienceCandidate): Flagged<ScienceEntry> {
  return { ...rowPart(c), source: c.source.url, judgedOn: c.source.readOn, evidence: 'candidate' };
}

export function holderFromCandidate(c: OwnershipCandidate): Flagged<Holder> {
  const holder = omit(rowPart(c), ['company', 'status', 'parent', 'ownedBy']);
  return {
    ...holder,
    asOf: c.asOf,
    source: c.source.url,
    readOn: c.source.readOn,
    evidence: 'candidate',
  };
}

/**
 * A candidate holder joins its company's row; a company with no row yet gets
 * one from the candidate's status line. Shares stay as the holder states them —
 * nothing here sums or checks them; test/ownership.test.ts does.
 */
export function withCandidateHolders(rows: readonly Ownership[], sidecar: unknown): Ownership[] {
  const candidates = sidecarRows<OwnershipCandidate>(sidecar);
  const byCompany = new Map(
    rows.map((row) => [row.company, { ...row, holders: [...row.holders] }]),
  );
  for (const c of candidates) {
    const row = byCompany.get(c.company);
    if (row) row.holders.push(holderFromCandidate(c));
    else
      byCompany.set(c.company, {
        company: c.company,
        status: c.status,
        ...(c.parent ? { parent: c.parent } : {}),
        ...(c.ownedBy ? { ownedBy: c.ownedBy } : {}),
        holders: [holderFromCandidate(c)],
      });
  }
  return [...byCompany.values()];
}

export function seriesPointFromCandidate(c: SeriesPointCandidate): Flagged<SeriesPoint> {
  const point = omit(rowPart(c), ['series']);
  return { ...point, source: c.source.url, quote: c.source.quote, evidence: 'candidate' };
}

/** Candidate points joined to their series; a series id the corpus lacks fails the build. */
export function withCandidatePoints<S extends Pick<Series, 'id' | 'points'>>(
  series: readonly S[],
  candidates: readonly SeriesPointCandidate[],
): S[] {
  const byId = new Map(series.map((s) => [s.id, { ...s, points: [...s.points] }]));
  for (const c of candidates) {
    const s = byId.get(c.series);
    if (!s)
      throw new Error(
        `config/candidates/series-points.json names series "${c.series}", which the corpus lacks`,
      );
    s.points.push(seriesPointFromCandidate(c));
  }
  return [...byId.values()];
}

/** The relation's stable id: the same rule `lib/graph/validate.ts` checks. */
export function relationCandidateId(c: Parameters<typeof relationId>[0]): string {
  return relationId(c);
}

/** A candidate relation as the graph reads it; `origin: 'candidate'` is what a page flags. */
export function relationFromCandidate(c: RelationCandidate): Relation {
  return {
    id: relationCandidateId(c),
    from: c.from,
    to: c.to,
    type: c.type,
    grade: c.grade,
    ...(c.share ? { share: c.share } : {}),
    ...(c.volume ? { volume: c.volume } : {}),
    asOf: c.asOf,
    evidence: [
      {
        source: c.source.url,
        quote: c.source.quote,
        readOn: c.source.readOn,
        ...(c.source.locator ? { locator: c.source.locator } : {}),
      },
    ],
    origin: 'candidate',
  };
}
