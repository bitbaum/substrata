import { defineModule, type AnyProfileModule } from '../define';
import type { ProfileModule } from '../types';
import type { Entity } from '../../entities/types';
import { related, discussion } from './shared';
import { products, topics, relief, gaps, timeline } from './company';

/**
 * The registry. A new section is one definition plus one entry here.
 *
 * Order is `importance`, not position in this array, so adding a module in the
 * middle of a profile does not mean renumbering anything.
 */
export const PROFILE_MODULES: AnyProfileModule[] = [
  products,
  topics,
  relief,
  gaps,
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
