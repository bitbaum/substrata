/**
 * The rules a relation must meet to exist, and the rules for counting it.
 *
 * A relation has a source, a quote and a date, or it is not a relation. On top
 * of that, each grade promises something different (docs/architecture/
 * 2026-10-24-research-systems.md §2), and the promise is checked here rather
 * than trusted:
 *
 * - `stated` carries at least one source with a quote;
 * - `corroborated` carries two or more, from different sources;
 * - `derived` names the relations it follows from and the rule that fired, and
 *   every one of those must itself be counted or derived — never a lead;
 * - `lead` may carry anything a source offered, and is never counted.
 *
 * `validateRelations` throws with every problem listed, so a bad row stops the
 * build instead of rendering as a fact. Pure: no config, no network.
 */
import { relationId } from './id';
import { ENTITY_KINDS } from '@/lib/entities/types';
import {
  COUNTED_GRADES,
  EVIDENCE_GRADES,
  RELATION_ORIGINS,
  RELATION_TYPES,
  type EvidenceGrade,
  type Relation,
  type RelationType,
} from './types';

/** Edge types that carry a stake. */
export const SHARE_TYPES: readonly RelationType[] = ['owns', 'finances'];
/** Edge types that carry a flow. */
export const VOLUME_TYPES: readonly RelationType[] = ['supplies', 'buys_from', 'ships_to'];
/** Edge types only an inference rule proposes, and only as a lead. */
export const LEAD_ONLY_TYPES: readonly RelationType[] = ['shares_parent_with', 'may_be_same_as'];

/** Grades from weakest to strongest, for `minGrade` filters. */
export const GRADE_ORDER: readonly EvidenceGrade[] = ['lead', 'derived', 'stated', 'corroborated'];

const PERIOD = /^\d{4}(-\d{2}(-\d{2})?)?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = new Set<string>(ENTITY_KINDS);
/** Shorter than this, a "quote" cannot carry a claim (the event gate uses the same floor). */
export const MIN_QUOTE = 10;
/** A table cell carries its claim with its row and column, so a short firm name ("Hafsil AS") is enough. */
export const MIN_CELL = 2;

export { relationId };

export function isEntityIdShape(id: string): boolean {
  const at = id.indexOf(':');
  return at > 0 && KINDS.has(id.slice(0, at)) && id.length > at + 1 && !/\s/.test(id);
}

/** Whether the relation may enter a number: a completeness score, a share, a coverage ratio. */
export function isCounted(r: Pick<Relation, 'grade'>): boolean {
  return COUNTED_GRADES.includes(r.grade);
}

/** The stake, only when the grade lets it be counted; a lead's share is never a number. */
export function countedShare(r: Relation): number | null {
  return isCounted(r) && r.share ? r.share.value : null;
}

export function atLeast(grade: EvidenceGrade, min: EvidenceGrade): boolean {
  return GRADE_ORDER.indexOf(grade) >= GRADE_ORDER.indexOf(min);
}

/** Problems with one relation on its own. Empty means it may exist. */
export function relationProblems(r: Relation, today = new Date()): string[] {
  const out: string[] = [];
  const day = today.toISOString().slice(0, 10);
  if (!isEntityIdShape(r.from)) out.push(`from "${r.from}" is not an entity id`);
  if (!isEntityIdShape(r.to)) out.push(`to "${r.to}" is not an entity id`);
  if (r.from === r.to) out.push('from and to are the same entity');
  if (!(RELATION_TYPES as readonly string[]).includes(r.type))
    out.push(`type "${r.type}" is not in RELATION_TYPES`);
  if (!(EVIDENCE_GRADES as readonly string[]).includes(r.grade))
    out.push(`grade "${r.grade}" is not an evidence grade`);
  if (r.origin !== undefined && !(RELATION_ORIGINS as readonly string[]).includes(r.origin))
    out.push(`origin "${r.origin}" is not a relation origin`);
  if (!PERIOD.test(r.asOf)) out.push(`asOf "${r.asOf}" is not YYYY, YYYY-MM or YYYY-MM-DD`);
  else if (r.asOf > day) out.push(`asOf ${r.asOf} is in the future`);
  if (r.id !== relationId(r)) out.push(`id must be "${relationId(r)}"`);

  if (r.share) {
    if (!SHARE_TYPES.includes(r.type)) out.push(`a ${r.type} edge cannot carry a share`);
    if (r.share.unit !== 'percent') out.push('share unit must be percent');
    if (!(r.share.value > 0 && r.share.value <= 100)) out.push('share must be in (0, 100]');
  }
  if (r.volume) {
    if (!VOLUME_TYPES.includes(r.type)) out.push(`a ${r.type} edge cannot carry a volume`);
    if (!(r.volume.value > 0)) out.push('volume must be positive');
    if (!r.volume.unit || !r.volume.period) out.push('volume needs a unit and a period');
  }

  for (const [i, e] of r.evidence.entries()) {
    if (!/^https?:\/\/\S+$/.test(e.source)) out.push(`evidence ${i}: source is not a web address`);
    if (e.quote.trim().length < (e.reading === 'table-cell' ? MIN_CELL : MIN_QUOTE))
      out.push(`evidence ${i}: the quote is too short to carry a claim`);
    if (!ISO_DATE.test(e.readOn)) out.push(`evidence ${i}: readOn is not YYYY-MM-DD`);
    else if (e.readOn > day) out.push(`evidence ${i}: readOn ${e.readOn} is in the future`);
  }
  const sources = new Set(r.evidence.map((e) => e.source));

  if (LEAD_ONLY_TYPES.includes(r.type) && r.grade !== 'lead')
    out.push(`a ${r.type} relation is only ever a lead`);
  if (r.grade === 'derived') {
    if (!r.derivedFrom?.length) out.push('a derived relation must name derivedFrom');
    if (!r.rule?.trim()) out.push('a derived relation must name its rule');
  } else if (r.grade === 'lead' && (r.derivedFrom || r.rule)) {
    // A lead a rule proposed names its chain like a derived relation does.
    if (!r.derivedFrom?.length || !r.rule?.trim())
      out.push('a rule-made lead names both derivedFrom and its rule');
    if (r.evidence.length === 0) out.push('a lead needs a source and a quote');
  } else {
    if (r.derivedFrom || r.rule) out.push('only a derived relation carries derivedFrom or rule');
    if (r.evidence.length === 0) out.push(`a ${r.grade} relation needs a source and a quote`);
  }
  if (r.grade === 'corroborated' && sources.size < 2)
    out.push('corroborated needs two independent sources');
  return out;
}

/** Problems across a set: duplicate ids and derivation chains. */
export function relationSetProblems(rows: readonly Relation[], today = new Date()): string[] {
  const out: string[] = [];
  const byId = new Map<string, Relation>();
  for (const r of rows) {
    for (const p of relationProblems(r, today)) out.push(`${r.id}: ${p}`);
    if (byId.has(r.id)) out.push(`${r.id}: listed twice`);
    byId.set(r.id, r);
  }
  for (const r of rows) {
    for (const parent of r.derivedFrom ?? []) {
      const p = byId.get(parent);
      if (!p) out.push(`${r.id}: derivedFrom ${parent} is not a relation`);
      else if (p.grade === 'lead') out.push(`${r.id}: derived from a lead (${parent})`);
    }
  }
  return out;
}

/** Throws with every problem when any relation breaks a rule. */
export function validateRelations(rows: readonly Relation[], today = new Date()): void {
  const problems = relationSetProblems(rows, today);
  if (problems.length)
    throw new Error(
      `${problems.length} relation problem(s):\n${problems.slice(0, 40).join('\n')}` +
        (problems.length > 40 ? `\n… and ${problems.length - 40} more` : ''),
    );
}
