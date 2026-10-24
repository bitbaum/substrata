/**
 * The shapes every research system shares. Design: docs/architecture/2026-10-24-research-systems.md.
 *
 * Kept free of imports from config/ and app/ so the graph, the dossiers, the
 * answer ladder and the source adapters can all depend on it without a cycle.
 */
import type { EntityId } from '@/lib/entities/types';

/**
 * How a claim is stood up. `derived` and `lead` can be wrong; neither raises a
 * completeness score or enters a coverage ratio, and the page says which it is.
 */
export const EVIDENCE_GRADES = ['stated', 'corroborated', 'derived', 'lead'] as const;
export type EvidenceGrade = (typeof EVIDENCE_GRADES)[number];

/** Grades that count towards completeness and mass-balance ratios. */
export const COUNTED_GRADES: readonly EvidenceGrade[] = ['stated', 'corroborated'];

/** A closed set. Adding a type is a deliberate edit here, not an accident. */
export const RELATION_TYPES = [
  'operates',
  'owns',
  'finances',
  'supplies',
  'buys_from',
  'ships_to',
  'licenses',
  'regulates',
  'researches',
  'employs',
  'competes_with',
] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

/** One independent source for one relation. */
export interface RelationEvidence {
  /** A URL a reader can open. */
  source: string;
  /** The sentence (or table cell) from that source that carries the claim. */
  quote: string;
  /** The day the source was read, ISO date. */
  readOn: string;
}

export interface Relation {
  /** Stable: `${from}|${type}|${to}|${asOf}`. */
  id: string;
  from: EntityId;
  to: EntityId;
  type: RelationType;
  grade: EvidenceGrade;
  /** For `owns` and `finances`: the stake, where a source states one. */
  share?: { value: number; unit: 'percent' };
  /** For `supplies`, `buys_from`, `ships_to`: what moved, where a source states it. */
  volume?: { value: number; unit: string; period: string; commodity?: string };
  /** When it was true — not when we filed it. ISO date or year. */
  asOf: string;
  /** One entry per independent source. `stated` needs one, `corroborated` two or more. */
  evidence: RelationEvidence[];
  /** Only for `derived`: the relation ids this follows from, and the rule that fired. */
  derivedFrom?: string[];
  rule?: string;
}

/**
 * The states of one box of a dossier. Computed from the rows that exist, never
 * set by hand.
 */
export type BoxStatus = 'full' | 'thin' | 'empty';

/**
 * A raw resource (`resource:uranium`, keys from config/substrata-resources.ts).
 * It has a page (/resources/<id>) and a dossier but no entity kind yet, so a
 * task about it cannot be typed as an `EntityId`.
 */
export type ResourceSubjectId = `resource:${string}`;

/** What a dossier or a task can be about: any entity, or a raw resource. */
export type SubjectId = EntityId | ResourceSubjectId;

/**
 * A piece of work: one empty or thin box, or one question the Ask could not
 * finish. This record is the whole interface to a cheaper model — it reads the
 * task, finds sources on the allowed list, and writes candidate rows.
 */
export interface GapTask {
  id: string;
  /** Widened from `EntityId` so a resource's boxes can be tasks too; every EntityId still fits. */
  entity: SubjectId;
  /** Which box of the entity's dossier, e.g. `facilities`, `owners`, `buyers`. */
  box: string;
  status: Exclude<BoxStatus, 'full'>;
  /** What is missing, in one plain sentence. */
  missing: string;
  /** Source families a reader would accept for this box, in order of preference. */
  allowedSources: string[];
  /** The candidate file and row schema the answer goes into. */
  writeTo: string;
  /** How many people asked something that needed this. 0 for a structural gap. */
  demand: number;
}
