/**
 * Relations written by hand, plus the candidate rows a data agent has added.
 *
 * Most relations are not typed here: they are derived from rows the corpus
 * already holds (`lib/graph/from-corpus.ts`) or parsed from a committed
 * research file (`research/usgs-relations.json`). This file is for a relation
 * that has no other home — a filing that names a customer, an offtake
 * agreement — written in the `Relation` shape with its source and quote.
 * `lib/graph/store.ts` reads all four and validates them together.
 *
 * Candidate rows (config/candidates/relations.json) arrive through
 * `scripts/research/add.ts` and keep `origin: 'candidate'` until a person
 * promotes them.
 */
import { relationFromCandidate, sidecarRows, type RelationCandidate } from '../lib/entry/candidate';
import type { Relation } from '../lib/graph/types';
import relationsCandidates from './candidates/relations.json';

export const RELATIONS: readonly Relation[] = [
  // Candidate rows (config/candidates/relations.json), each `origin: 'candidate'`.
  ...sidecarRows<RelationCandidate>(relationsCandidates).map(relationFromCandidate),
];
