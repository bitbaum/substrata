import { defineModule, type AnyProfileModule } from '../define';
import type { ProfileModule } from '../types';
import type { Entity } from '../../entities/types';
import { related, discussion } from './shared';
import { timeline } from './timeline';
import { products, topics, relief, gaps } from './company';
import { relieves, readiness, milestone } from './science';
import { mandate, canMove, source } from './capital';
import { why, severity, producers, rules, removes, calls, funding, loops } from './bottleneck';

/**
 * The registry. A new section is one definition plus one entry here.
 *
 * `importance` is a shared scale across every kind, not a per-kind ordering, so
 * profiles read the same way whatever you are looking at: what it is, how it is
 * judged, who is involved, what governs it, what would change it, what has
 * happened, what it connects to, and then the discussion.
 *
 *   10  what this thing is
 *   20  how it is judged or graded
 *   30  who or what is involved
 *   40+ what governs it, what would change it, what was predicted, who funds it
 *   80  what has happened
 *   84+ what it connects to
 *   90  discussion, last, because it responds to everything above
 */
export const PROFILE_MODULES: AnyProfileModule[] = [
  // Bottleneck
  why,
  severity,
  producers,
  rules,
  removes,
  calls,
  funding,
  loops,
  // Company
  products,
  topics,
  relief,
  gaps,
  // Science
  relieves,
  readiness,
  milestone,
  // Capital
  mandate,
  canMove,
  source,
  // Every kind that has them
  timeline,
  related,
  discussion,
].map((module) => defineModule(module as ProfileModule<unknown>));

/**
 * The modules that apply to an entity, in render order.
 *
 * Selection lives here rather than in the component so the page, a future
 * compare view and the tests all ask the same question.
 */
export function modulesFor(entity: Entity, from?: number): AnyProfileModule[] {
  return PROFILE_MODULES.filter(
    (module) => module.applies(entity.kind) && (from === undefined || module.importance >= from),
  ).sort((a, b) => a.importance - b.importance);
}
