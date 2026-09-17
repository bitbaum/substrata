import type { ReactNode } from 'react';

import type { Entity, EntityKind } from '../entities/types';
import { appliesTo, type ProfileModule } from './types';

/**
 * A module with its data type erased, which is what a registry can hold.
 *
 * Modules are authored generically (`ProfileModule<Leadership>`), but a list of
 * differently-typed modules has no single `T`. Rather than cast the registry to
 * `any` or `never` — which silently turns off checking inside every module —
 * `defineModule` closes over the type at the point of definition and hands back
 * a uniform `render`. Each module stays fully typed; the registry stays honest.
 */
export interface AnyProfileModule {
  id: string;
  title: string;
  appliesTo: readonly EntityKind[] | '*';
  importance: number;
  ownsHeading: boolean;
  /** Null when the module has nothing to say for this entity. */
  render(entity: Entity): { node: ReactNode; evidence?: string } | null;
  applies(kind: EntityKind): boolean;
}

export function defineModule<T>(module: ProfileModule<T>): AnyProfileModule {
  const { Render } = module;
  return {
    id: module.id,
    title: module.title,
    appliesTo: module.appliesTo,
    importance: module.importance,
    ownsHeading: module.ownsHeading ?? false,
    applies: (kind) => appliesTo(module as ProfileModule<unknown>, kind),
    render(entity) {
      const data = module.load(entity);
      if (data === null || data === undefined) return null;
      return {
        node: <Render entity={entity} data={data} />,
        evidence: module.evidence?.(data),
      };
    },
  };
}
