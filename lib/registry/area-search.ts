/** Area search through @bitbaum/searchkit (never a ranker of ours). */
import { createSearch, type SearchSpec } from '@bitbaum/searchkit';

import { membersOf } from './areas';
import { registry } from './load';
import type { Area } from './schema';

export interface AreaRow {
  area: Area;
  memberNames: string;
}

export const AREA_SEARCH: SearchSpec<AreaRow> = {
  fields: [
    { name: 'name', get: (r) => r.area.name },
    { name: 'definition', get: (r) => r.area.definition },
    { name: 'members', get: (r) => r.memberNames },
  ],
};

export function searchAreas(q: string): Area[] {
  const cs = registry().companies;
  const rows = registry().areas.map((area) => ({
    area,
    memberNames: membersOf(area.slug, cs)
      .map((c) => [c.name, ...c.aliases].join(' '))
      .join(' '),
  }));
  return createSearch(rows, AREA_SEARCH)
    .search(q, { relax: false })
    .map((h) => h.item.area);
}
