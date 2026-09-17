import type { ReactNode } from 'react';
import type { Entity, EntityKind } from '../entities/types';

/**
 * A profile is an ordered list of modules, not a bespoke page per kind.
 *
 * The point is that adding a section — leadership, stock performance, an
 * analyst view — is one file and one registry line, and it then appears on
 * every kind it declares. Fifteen hand-written pages cannot offer that, and
 * they drift: the same fact ends up presented three ways because three pages
 * grew separately.
 *
 * Two rules keep profiles comparable:
 *  - `load` returns null when a module has nothing to say, and the module is
 *    then not rendered at all. Empty shells teach a reader nothing and make two
 *    entities look different when only the data differs.
 *  - a module states how its own data is evidenced, so a section can never
 *    imply more certainty than the corpus has.
 */
export interface ProfileModule<T = unknown> {
  /** Stable id, used for anchors, ordering overrides and tests. */
  id: string;
  title: string;
  /** Which kinds this module can render for. `'*'` means every kind. */
  appliesTo: readonly EntityKind[] | '*';
  /**
   * Lower sorts earlier. Also drives progressive disclosure: the first few
   * modules answer "what is this and why does it matter" and stay open, the
   * rest collapse behind a one-line summary.
   */
  importance: number;
  /** Return null to render nothing. Never return an empty object to fill space. */
  load(entity: Entity): T | null;
  Render(props: { entity: Entity; data: T }): ReactNode;
  /** How this module's data is evidenced, in the corpus's vocabulary. */
  evidence?(data: T): string;
  /**
   * True when the module renders its own heading. Discussion does, because the
   * same component is mounted directly on article pages, and wrapping it in a
   * second heading printed "Discussion" twice.
   */
  ownsHeading?: boolean;
}

export function appliesTo(module: ProfileModule<unknown>, kind: EntityKind): boolean {
  return module.appliesTo === '*' || module.appliesTo.includes(kind);
}
