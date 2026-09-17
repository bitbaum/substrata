import type { EntityId, Evidence } from '../entities/types';

/**
 * The web, as a schema.
 *
 * Substrata's claim is that the constraints on faster technology are connected:
 * a firm makes a material, a material gates a loop, a rule slows the firm, a
 * mandate could fund relief. The value is in the joins, so the joins have to be
 * as disciplined as the rows.
 *
 * Before this they were free strings built ad hoc per kind. "makes" and
 * "produced by" were the same fact declared twice in two directions, so they
 * could drift; a policy instrument was emitted with `kind: 'capital'`, so rules
 * appeared as capital on a country dossier; and no edge carried evidence at
 * all, which meant an unverified lead and a sourced finding rendered as the
 * same line. That last one matters most: this site exists to keep those apart.
 */
export const RELATION_KINDS = [
  'produces',
  'located-in',
  'relieved-by',
  'fundable-by',
  'governed-by',
  'in-force-in',
  'endowed-with',
  'gates',
] as const;

export type RelationKind = (typeof RELATION_KINDS)[number];

/**
 * A relation is declared once, in one direction, and read from both.
 *
 * `forward` reads from → to; `inverse` reads to → from. Declaring each half
 * separately is how the old graph ended up asserting `makes` on one page and
 * `produced by` on another with no guarantee they agreed.
 */
export const RELATION_LABEL: Record<RelationKind, { forward: string; inverse: string }> = {
  produces: { forward: 'makes', inverse: 'produced by' },
  'located-in': { forward: 'located in', inverse: 'hosts' },
  'relieved-by': { forward: 'relieved by', inverse: 'would relieve' },
  'fundable-by': { forward: 'fundable by', inverse: 'could fund' },
  'governed-by': { forward: 'governed by', inverse: 'governs' },
  'in-force-in': { forward: 'in force in', inverse: 'sets' },
  'endowed-with': { forward: 'endowed with', inverse: 'found in' },
  gates: { forward: 'gates', inverse: 'gated by' },
};

export interface Relation {
  kind: RelationKind;
  from: EntityId;
  to: EntityId;
  /**
   * How well THIS JOIN is stood up — not how well either end is.
   *
   * A sourced company and a sourced material can still be connected by nothing
   * more than a directory guess, and the reader is entitled to know which.
   */
  evidence: Evidence;
  sources: string[];
}

/** A relation as read from one end: the other end, and how it reads in that direction. */
export interface Connection {
  kind: RelationKind;
  /** The entity at the other end. */
  other: EntityId;
  label: string;
  evidence: Evidence;
  sources: string[];
}
