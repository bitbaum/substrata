/**
 * Facet `ranking`: one row per country per resource table — its computed share
 * of world output and its rank, with reserves beside it. These are the rows a
 * "what is X known for" or "who produces Y" question needs as text, not just as
 * a table behind a tool.
 */
import { RESOURCE_TO_BOTTLENECKS, type ResourceId } from '@/config/substrata-resources';
import { formatShare, ordinal } from '../../resources/format';
import { resourceRanking, type ResourceRanking } from '../../resources/ranking';
import { resourcesWithData } from '../../resources/usgs';
import { chunkId, makeChunk, type Chunk } from '../chunk';
import { bottleneckIdByName, countryId, uniqueIds } from './ids';

let rankings: ResourceRanking[] | null = null;

/** Every resource table's ranking, built once: they are derived from committed files. */
export function allRankings(): ResourceRanking[] {
  rankings ??= resourcesWithData()
    .map(resourceRanking)
    .filter((r): r is ResourceRanking => r !== null);
  return rankings;
}

/** A country's computed share of world output of one resource, or 0 when the table has none. */
export function shareOf(resource: string, iso2: string): number {
  const ranking = allRankings().find((r) => r.resource === resource);
  return ranking?.rows.find((row) => row.iso2 === iso2)?.production.share ?? 0;
}

export function resourceBottleneckIds(resource: string): string[] {
  return uniqueIds(
    ...(RESOURCE_TO_BOTTLENECKS[resource as ResourceId] ?? []).map(bottleneckIdByName),
  );
}

export function rankingChunks(): Chunk[] {
  return allRankings().flatMap((ranking) => {
    const p = ranking.production;
    const bottlenecks = resourceBottleneckIds(ranking.resource);
    return ranking.rows
      .filter((row) => (row.production.share ?? 0) > 0 || (row.reserves?.share ?? 0) > 0)
      .map((row) => {
        const produced =
          row.production.share !== null && row.production.rank !== null
            ? `${formatShare(row.production.share)} of world ${ranking.label.toLowerCase()} (${p.label.toLowerCase()}), ${ordinal(row.production.rank)}, ${p.year}: ${row.production.text} ${p.unitLabel}`
            : `${ranking.label} ${p.label.toLowerCase()} ${p.year}: ${row.production.text}`;
        const reserves =
          row.reserves && ranking.reserves
            ? `; reserves ${row.reserves.text} ${ranking.reserves.unitLabel}${row.reserves.share !== null ? ` (${formatShare(row.reserves.share)} of world${row.reserves.rank ? `, ${ordinal(row.reserves.rank)}` : ''})` : ''}`
            : '';
        const restricted = row.restrictions
          ? `; ${row.restrictions} OECD export-restriction measure${row.restrictions === 1 ? '' : 's'} recorded`
          : '';
        return makeChunk({
          id: chunkId('ranking', `${ranking.resource}/${row.iso2}`),
          facet: 'ranking',
          kind: 'country',
          entityIds: uniqueIds(countryId(row.iso2), bottlenecks),
          title: `${row.name} — ${ranking.label}`,
          text: `${row.name}: ${produced}${reserves}${restricted}. Shares and ranks are computed from the ${p.source.label} table.`,
          href: `/resources/${ranking.resource}`,
          sourceUrl: p.source.url,
          evidence: 'computed',
          asOf: String(p.year),
          significance: row.production.share ?? row.reserves?.share ?? 0,
        });
      });
  });
}
