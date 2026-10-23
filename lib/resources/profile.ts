/**
 * One resource as a profile: the numbers at a glance, the rows the charts
 * draw, who needs it, who restricts it, and what has happened to it. Every
 * figure here is read from `resourceRanking` (USGS/EIA) or the OECD
 * inventory, so the tiles at the top cannot disagree with the table below.
 * test/places.test.ts holds that equality.
 */
import { EVENTS, type CoverageEvent } from '@/config/substrata-events';
import { RESOURCE_TO_BOTTLENECKS, resourceLabel } from '@/config/substrata-resources';
import { BOTTLENECKS, type Bottleneck } from '../bottlenecks';
import { formatShare, formatValue, ordinal } from './format';
import { resourceRanking, type RankingRow, type ResourceRanking } from './ranking';
import {
  countByKind,
  groupByCountry,
  type CountryMeasures,
  type KindCount,
} from './restriction-kinds';
import { restrictionsOn, type Restriction } from './restrictions';
import { chapterFor, type UsgsChapter } from './usgs';

export interface ChartRow {
  iso2: string;
  label: string;
  value: number;
  share: number | null;
  rank: number;
  estimated: boolean;
}

export interface ResourceProfile {
  resource: string;
  label: string;
  chapter: UsgsChapter;
  ranking: ResourceRanking;
  glance: {
    world: { text: string; year: number; unitLabel: string; seriesLabel: string };
    top: { iso2: string; name: string; share: number | null; text: string } | null;
    hhi: number | null;
    reservesHhi: number | null;
    restricting: number;
    measures: number;
  };
  /** Countries with a positive production figure, largest first. */
  production: ChartRow[];
  /** Countries with a positive reserves figure, largest first; empty without a reserves table. */
  reserves: ChartRow[];
  /** Bottlenecks that need this resource, worst first. */
  users: Bottleneck[];
  restrictions: { all: Restriction[]; byKind: KindCount[]; byCountry: CountryMeasures[] };
  events: CoverageEvent[];
}

function chartRows(
  rows: RankingRow[],
  pick: (r: RankingRow) => RankingRow['reserves'],
): ChartRow[] {
  return rows
    .map((r) => ({ r, v: pick(r) }))
    .filter(({ v }) => v && v.value !== null && v.value > 0 && v.rank !== null)
    .map(({ r, v }) => ({
      iso2: r.iso2,
      label: r.name,
      value: v!.value as number,
      share: v!.share,
      rank: v!.rank as number,
      estimated: 'estimated' in v! ? Boolean((v as RankingRow['production']).estimated) : false,
    }))
    .sort((a, b) => a.rank - b.rank);
}

/** The bottlenecks a resource feeds: the directory's map, plus any whose name says so. */
export function usersOf(resource: string): Bottleneck[] {
  const named = new Set(
    RESOURCE_TO_BOTTLENECKS[resource as keyof typeof RESOURCE_TO_BOTTLENECKS] ?? [],
  );
  const word = resourceLabel(resource).toLowerCase().replace(/s$/, '');
  return BOTTLENECKS.filter((b) => named.has(b.name) || b.name.toLowerCase().includes(word)).sort(
    (a, b) => b.binding - a.binding || a.name.localeCompare(b.name),
  );
}

/** Accepted events on the bottlenecks it feeds, or whose headline names it. */
export function eventsNaming(resource: string, users: readonly Bottleneck[]): CoverageEvent[] {
  const names = new Set(users.map((u) => u.name));
  const word = resourceLabel(resource).toLowerCase().replace(/s$/, '');
  return [...EVENTS]
    .filter(
      (e) => e.bottlenecks.some((n) => names.has(n)) || e.headline.toLowerCase().includes(word),
    )
    .sort((x, y) => y.date.localeCompare(x.date));
}

export function resourceProfile(resource: string): ResourceProfile | null {
  const ranking = resourceRanking(resource);
  const chapter = chapterFor(resource);
  if (!ranking || !chapter) return null;
  const p = ranking.production;
  const production = chartRows(ranking.rows, (r) => r.production);
  const reserves = ranking.reserves ? chartRows(ranking.rows, (r) => r.reserves) : [];
  const all = restrictionsOn(resource);
  const byCountry = groupByCountry(all);
  const top = production[0] ?? null;
  const users = usersOf(resource);
  return {
    resource,
    label: ranking.label,
    chapter,
    ranking,
    glance: {
      world: { text: p.world.text, year: p.year, unitLabel: p.unitLabel, seriesLabel: p.label },
      top: top
        ? {
            iso2: top.iso2,
            name: top.label,
            share: top.share,
            text: `${formatValue(top.value)}${top.estimated ? 'e' : ''}`,
          }
        : null,
      hhi: p.hhi,
      reservesHhi: ranking.reserves?.hhi ?? null,
      restricting: byCountry.length,
      measures: all.length,
    },
    production,
    reserves,
    users,
    restrictions: { all, byKind: countByKind(all), byCountry },
    events: eventsNaming(resource, users),
  };
}

/**
 * Whether production and reserves can be drawn as shares side by side: both
 * need a computable share, which a world total printed as "more than"
 * (rare-earth reserves) denies. The page adds the section only when this is
 * true, so a heading never stands over nothing.
 */
export function hasReservesShares(profile: ResourceProfile): boolean {
  return (
    profile.production.some((r) => r.share !== null) &&
    profile.reserves.some((r) => r.share !== null)
  );
}

/** "China, 98% (1st)" — the top producer in words, for a tile or a lede. */
export function topLine(profile: ResourceProfile): string {
  const t = profile.glance.top;
  if (!t) return 'no country listed';
  return t.share !== null ? `${t.name}, ${formatShare(t.share)}` : `${t.name} (${ordinal(1)})`;
}
