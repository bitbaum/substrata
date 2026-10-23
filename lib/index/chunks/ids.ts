/**
 * Entity ids for the names config rows carry.
 *
 * Config refers to things by the names the pages show — a bottleneck by its
 * name, a participant by its name, a country by its ISO code — and the index
 * joins on `EntityId`. Every resolver here returns nothing rather than a
 * guessed id, so a chunk can never claim to be about an entity that does not
 * exist; the coverage test then proves every entity is reached some other way.
 */
import { bottleneckByName, bottleneckBySlug } from '../../bottlenecks';
import { resolveEntity, resolveIn } from '../../entities/registry';
import { entityId } from '../../entities/types';

export function countryId(iso2: string | null | undefined): string[] {
  if (!iso2) return [];
  const id = entityId('country', iso2.toLowerCase());
  return resolveEntity(id) ? [id] : [];
}

export function countryName(iso2: string): string {
  return resolveEntity(entityId('country', iso2.toLowerCase()))?.name ?? iso2.toUpperCase();
}

export function bottleneckIdByName(name: string): string[] {
  const b = bottleneckByName(name);
  return b ? [entityId('bottleneck', b.slug)] : [];
}

export function bottleneckIdBySlug(slug: string): string[] {
  const b = bottleneckBySlug(slug);
  return b ? [entityId('bottleneck', b.slug)] : [];
}

export function companyIdByName(name: string): string[] {
  const c = resolveIn('company', name);
  return c ? [c.id] : [];
}

/** Deduplicated, in first-seen order. */
export function uniqueIds(...lists: readonly string[][]): string[] {
  return [...new Set(lists.flat())];
}
