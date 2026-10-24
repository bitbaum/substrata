/**
 * Row counts for a raw resource's boxes.
 */
import { SCIENCE } from '@/config/substrata-science';
import { SUBSTITUTES } from '@/config/substrata-substitutes';
import { usersOf } from '@/lib/resources/profile';
import { resourceRanking } from '@/lib/resources/ranking';
import { restrictionsOn } from '@/lib/resources/restrictions';
import type { RowCounts } from '../definitions';
import type { Subject } from '../subjects';
import { NOTHING, USGS_ROWS, gradeOf, tally } from './shared';

function producers(resource: string): RowCounts {
  const ranking = resourceRanking(resource);
  const facilities = USGS_ROWS.filter((r) => r.resource === resource).length;
  if (!ranking) return { ...NOTHING, core: facilities, basis: 'no world production table' };
  const rows = ranking.rows.filter((r) => r.production.value !== null && r.production.value > 0);
  return tally(
    rows,
    () => 'stated',
    `${rows.length} producing countries in the ${ranking.production.year} table; ${facilities} USGS facility rows`,
    { core: facilities },
  );
}

function reserves(resource: string): RowCounts {
  const ranking = resourceRanking(resource);
  if (!ranking?.reserves) return { ...NOTHING, basis: 'no reserves column in the tables read' };
  const rows = ranking.rows.filter(
    (r) => r.reserves?.value !== null && r.reserves?.value !== undefined,
  );
  return tally(rows, () => 'stated', `${rows.length} countries with a stated reserve`);
}

function uses(resource: string): RowCounts {
  const users = usersOf(resource);
  return tally(users, () => 'stated', `${users.length} tracked bottlenecks it feeds`);
}

function substitutes(resource: string): RowCounts {
  const slugs = new Set(usersOf(resource).map((b) => b.slug));
  const rows = SUBSTITUTES.filter((s) => slugs.has(s.material));
  return tally(
    rows,
    (s) => (s.sources.length > 0 ? 'stated' : 'lead'),
    `${rows.length} substitutes recorded for what it feeds`,
  );
}

function restrictions(resource: string): RowCounts {
  const rows = restrictionsOn(resource);
  return tally(rows, () => 'stated', `${rows.length} OECD export measures`);
}

function science(resource: string): RowCounts {
  const names = new Set(usersOf(resource).map((b) => b.name));
  const rows = SCIENCE.filter((e) => e.relieves.some((r) => names.has(r.bottleneck)));
  return tally(
    rows,
    (e) => (e.source !== null && gradeOf(e) === 'stated' ? 'stated' : 'lead'),
    `${rows.length} science entries relieve what it feeds`,
  );
}

export const RESOURCE_COUNTERS: Record<string, (s: Subject) => RowCounts> = {
  producers: (s) => producers(s.key),
  reserves: (s) => reserves(s.key),
  uses: (s) => uses(s.key),
  substitutes: (s) => substitutes(s.key),
  restrictions: (s) => restrictions(s.key),
  science: (s) => science(s.key),
};
