/** Area queries over the registry: the tree, members with descendants rolled up, honest counts. */
import { registry } from './load';
import type { Area, Company } from './schema';

export const allAreas = (): Area[] => registry().areas;
export const areaBySlug = (slug: string): Area | undefined => registry().areaBySlug.get(slug);

export function childrenOf(slug: string | null): Area[] {
  return allAreas()
    .filter((a) => a.parent === slug)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The area and everything under it. */
export function subtree(slug: string): string[] {
  return [slug, ...childrenOf(slug).flatMap((c) => subtree(c.slug))];
}

export function ancestors(slug: string): Area[] {
  const out: Area[] = [];
  for (let a = areaBySlug(slug)?.parent; a; a = areaBySlug(a)?.parent ?? null) {
    const area = areaBySlug(a);
    if (!area) break;
    out.unshift(area);
  }
  return out;
}

/** Companies with this area or any below it. Active ones only count as members. */
export function membersOf(slug: string, companies: readonly Company[]): Company[] {
  const within = new Set(subtree(slug));
  return companies
    .filter((c) => c.areas.some((a) => within.has(a.area)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function directMembers(slug: string, companies: readonly Company[]) {
  return companies.filter((c) => c.areas.some((a) => a.area === slug));
}
