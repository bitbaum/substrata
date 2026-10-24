/**
 * The seam where the relation graph plugs into completeness.
 *
 * Boxes such as a country's trade or a company's customers are filled by
 * typed relations (`ships_to`, `supplies`, `owns` …), which live in the graph
 * store (lib/graph). The dossier does not import that store: it asks a
 * `RelationCounter`, and until one is passed the answer is zero, which is
 * honest — no relation file exists yet.
 *
 * To plug the graph in, implement the one method over the store and pass it:
 *
 *   computeDossier('country:kz', { relations: graphRelationCounter })
 *   emitTasks({ relations: graphRelationCounter })
 *
 * The counter returns rows by grade; the dossier then counts only `stated`
 * and `corroborated`, so a derived or lead edge is shown and never moves a box.
 */
import type { EvidenceGrade } from '@/lib/graph/types';
import type { RelationQuery } from './definitions';

export type GradeCounts = Record<EvidenceGrade, number>;

export interface RelationCounter {
  /** Relations touching `subject` (an EntityId or `resource:<id>`) that match the query, by grade. */
  count(subject: string, query: RelationQuery): GradeCounts;
}

export const ZERO_GRADES: GradeCounts = { stated: 0, corroborated: 0, derived: 0, lead: 0 };

/** The default: no relation store is wired in, so every relation box counts nothing. */
export const NO_RELATIONS: RelationCounter = { count: () => ({ ...ZERO_GRADES }) };
