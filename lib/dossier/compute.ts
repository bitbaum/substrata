/**
 * A subject's dossier, computed: every box of its kind with a status and the
 * counts behind it. Nothing here is stored; the same rows always give the
 * same dossier.
 *
 * Relation boxes ask a `RelationCounter` (./relations.ts). The default counts
 * nothing; pass the graph's counter once it exists.
 */
import type { BoxStatus } from '@/lib/graph/types';
import { COMPANY_COUNTERS } from './counters/company';
import { COUNTRY_COUNTERS } from './counters/country';
import { LAB_COUNTERS } from './counters/lab';
import { RESOURCE_COUNTERS } from './counters/resource';
import { SCIENCE_COUNTERS } from './counters/science';
import { NOTHING, plus } from './counters/shared';
import {
  boxStatus,
  boxesFor,
  countedRows,
  fullMeans,
  type BoxDefinition,
  type DossierKind,
  type RowCounts,
} from './definitions';
import { NO_RELATIONS, type RelationCounter } from './relations';
import { resolveSubject, type Subject } from './subjects';

const COUNTERS: Record<DossierKind, Record<string, (s: Subject) => RowCounts>> = {
  country: COUNTRY_COUNTERS,
  company: COMPANY_COUNTERS,
  resource: RESOURCE_COUNTERS,
  lab: LAB_COUNTERS,
  science: SCIENCE_COUNTERS,
};

export interface BoxResult {
  box: string;
  label: string;
  status: BoxStatus;
  counts: RowCounts;
  /** `stated` + `corroborated`: the rows that moved the box. */
  counted: number;
  /** What a full box needs, in words. */
  fullMeans: string;
  /** What is missing, in one plain sentence; null when the box is full. */
  missing: string | null;
  noSourceYet: boolean;
}

export interface Dossier {
  subject: Subject;
  boxes: BoxResult[];
  tally: Record<BoxStatus, number>;
}

export interface ComputeOptions {
  relations?: RelationCounter;
}

function relationCounts(def: BoxDefinition, subject: Subject, counter: RelationCounter): RowCounts {
  let total: RowCounts = { ...NOTHING };
  for (const query of def.relations ?? []) {
    const g = counter.count(subject.id, query);
    const n = g.stated + g.corroborated + g.derived + g.lead;
    total = plus(total, {
      ...g,
      basis: n > 0 ? `${n} ${query.types.join('/')} relations` : '',
    });
  }
  return total;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** One sentence: what the box lacks, with the counts that say so. */
export function missingSentence(
  def: BoxDefinition,
  subject: Subject,
  r: Omit<BoxResult, 'missing'>,
): string | null {
  if (r.status === 'full') return null;
  const leads =
    r.counts.lead > 0
      ? ` ${plural(r.counts.lead, 'candidate row')} wait for review and do not count.`
      : '';
  const derived =
    r.counts.derived > 0
      ? ` ${plural(r.counts.derived, 'derived row')} are shown but never counted.`
      : '';
  if (r.status === 'empty') {
    const why =
      def.noSourceYet && r.counted === 0 ? ' No source in the repository feeds this box yet.' : '';
    return `${subject.name}: no stated ${def.unit} answers "${def.question}" — a full box has ${r.fullMeans}.${why}${leads}${derived}`;
  }
  const short: string[] = [];
  if (r.counted < def.thresholds.full)
    short.push(
      `${plural(r.counted, `stated ${def.unit}`, `stated ${def.units}`)} of ${def.thresholds.full}`,
    );
  if (r.counts.expected !== undefined && r.counted < r.counts.expected)
    short.push(`${r.counted} of ${r.counts.expected} expected rows stated`);
  if (
    def.thresholds.core !== undefined &&
    (r.counts.core ?? 0) < def.thresholds.core &&
    def.coreNeed
  )
    short.push(`missing ${def.coreNeed}`);
  return `${subject.name}: ${def.label.toLowerCase()} is thin — ${short.join('; ') || 'below full'}. A full box has ${r.fullMeans}.${leads}${derived}`;
}

export function computeBox(
  def: BoxDefinition,
  subject: Subject,
  opts: ComputeOptions = {},
): BoxResult {
  const counter = COUNTERS[subject.kind][def.id];
  const own = counter ? counter(subject) : { ...NOTHING, basis: 'no source in the repository yet' };
  const counts = def.relations
    ? plus(own, relationCounts(def, subject, opts.relations ?? NO_RELATIONS))
    : own;
  const base = {
    box: def.id,
    label: def.label,
    status: boxStatus(counts, def.thresholds),
    counts,
    counted: countedRows(counts),
    fullMeans: fullMeans(def),
    noSourceYet: def.noSourceYet === true,
  };
  return { ...base, missing: missingSentence(def, subject, base) };
}

const cache = new Map<string, Dossier | null>();

/**
 * The dossier for a subject id (`country:kz`, `company:asml`, `resource:uranium`,
 * `lab:<id>`, `science:<id>`), or null when the id names nothing. Memoised per process for
 * the default (no relations) counter, because every input is static config.
 */
export function computeDossier(id: string, opts: ComputeOptions = {}): Dossier | null {
  const memo = opts.relations === undefined;
  if (memo && cache.has(id)) return cache.get(id) ?? null;
  const subject = resolveSubject(id);
  const dossier = subject ? build(subject, opts) : null;
  if (memo) cache.set(id, dossier);
  return dossier;
}

function build(subject: Subject, opts: ComputeOptions): Dossier {
  const boxes = boxesFor(subject.kind).map((def) => computeBox(def, subject, opts));
  const tally: Record<BoxStatus, number> = { full: 0, thin: 0, empty: 0 };
  for (const b of boxes) tally[b.status] += 1;
  return { subject, boxes, tally };
}
