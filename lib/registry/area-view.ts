/** What the area pages print, built from the registry: honest counts, no invented ones. */
import { ancestors, areaBySlug, childrenOf, directMembers, membersOf } from './areas';
import { registry } from './load';
import type { Area, Company } from './schema';

export interface AreaCard {
  area: Area;
  /** Companies registered in the area or below it. */
  members: number;
  /** Of those, how many have a cited "what it is" sentence. */
  described: number;
  children: { area: Area; members: number }[];
}

export function areaCards(parent: string | null = null): AreaCard[] {
  const cs = registry().companies;
  const count = (slug: string) => membersOf(slug, cs).length;
  return childrenOf(parent).map((area) => {
    const all = membersOf(area.slug, cs);
    return {
      area,
      members: all.length,
      described: all.filter((c) => c.summary).length,
      children: childrenOf(area.slug).map((c) => ({ area: c, members: count(c.slug) })),
    };
  });
}

export interface AreaPage {
  area: Area;
  trail: Area[];
  children: { area: Area; members: number }[];
  members: { company: Company; role?: string; direct: boolean }[];
  described: number;
}

export function areaPage(slug: string): AreaPage | undefined {
  const area = areaBySlug(slug);
  if (!area) return undefined;
  const cs = registry().companies;
  const direct = new Set(directMembers(slug, cs).map((c) => c.slug));
  const members = membersOf(slug, cs).map((company) => ({
    company,
    role: company.areas.find((a) => a.area === slug)?.role,
    direct: direct.has(company.slug),
  }));
  return {
    area,
    trail: ancestors(slug),
    children: childrenOf(slug).map((c) => ({ area: c, members: membersOf(c.slug, cs).length })),
    members,
    described: members.filter((m) => m.company.summary).length,
  };
}
