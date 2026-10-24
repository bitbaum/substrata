/**
 * What a dossier can be about, and how a subject id maps to a dossier kind.
 *
 *   country:<iso2>   → country      (every country with a profile page)
 *   company:<slug>   → company      (every directory company)
 *   resource:<id>    → resource     (config/substrata-resources.ts)
 *   science:<id>     → lab          (until labs and people are a kind; boxes/lab.ts)
 */
import { RESOURCE_KINDS, resourceLabel } from '@/config/substrata-resources';
import { entitiesOfKind, resolveEntity } from '@/lib/entities/registry';
import type { SubjectId } from '@/lib/graph/types';
import type { DossierKind } from './definitions';

export interface Subject {
  id: SubjectId;
  kind: DossierKind;
  key: string;
  name: string;
  href: string;
}

const ENTITY_KIND_FOR: Record<
  Exclude<DossierKind, 'resource'>,
  'country' | 'company' | 'science'
> = {
  country: 'country',
  company: 'company',
  lab: 'science',
};

/** The subject an id names, or undefined when nothing in the corpus answers to it. */
export function resolveSubject(id: string): Subject | undefined {
  const at = id.indexOf(':');
  if (at < 0) return undefined;
  const prefix = id.slice(0, at);
  const key = id.slice(at + 1);
  if (prefix === 'resource') {
    if (!RESOURCE_KINDS.some((r) => r.id === key)) return undefined;
    return {
      id: `resource:${key}`,
      kind: 'resource',
      key,
      name: resourceLabel(key),
      href: `/resources/${key}`,
    };
  }
  const kind = (Object.keys(ENTITY_KIND_FOR) as Exclude<DossierKind, 'resource'>[]).find(
    (k) => ENTITY_KIND_FOR[k] === prefix,
  );
  if (!kind) return undefined;
  const entity = resolveEntity(id);
  if (!entity) return undefined;
  return { id: entity.id, kind, key: entity.key, name: entity.name, href: entity.href };
}

/** Every subject of a dossier kind, in the registry's stable order. */
export function subjectsOf(kind: DossierKind): Subject[] {
  if (kind === 'resource') {
    return RESOURCE_KINDS.map((r) => resolveSubject(`resource:${r.id}`)).filter(
      (s): s is Subject => s !== undefined,
    );
  }
  return entitiesOfKind(ENTITY_KIND_FOR[kind]).map((entity) => ({
    id: entity.id,
    kind,
    key: entity.key,
    name: entity.name,
    href: entity.href,
  }));
}
