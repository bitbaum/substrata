/**
 * Facet `restriction`: what the OECD inventory records one country doing to
 * the export of one resource — every measure, grouped, with the year the
 * earliest began. Absence from the inventory is never "unrestricted", and
 * nothing here says it is.
 */
import { resourceLabel } from '@/config/substrata-resources';
import {
  restrictionSummary,
  RESTRICTIONS_SOURCE,
  restrictionsFor,
  type Restriction,
} from '../../resources/restrictions';
import data from '@/research/oecd-export-restrictions.json';
import { chunkId, makeChunk, type Chunk } from '../chunk';
import { countryId, countryName, uniqueIds } from './ids';
import { resourceBottleneckIds, shareOf } from './ranking';

const MEASURES = (data as unknown as { measures: Pick<Restriction, 'iso2' | 'resource'>[] })
  .measures;

export function restrictionChunks(): Chunk[] {
  const pairs = [...new Set(MEASURES.map((m) => `${m.iso2}/${m.resource}`))].sort();
  return pairs.map((pair) => {
    const [iso2, resource] = pair.split('/');
    const measures = restrictionsFor(iso2, resource);
    const since = measures
      .map((m) => m.introduced)
      .filter((d): d is string => Boolean(d))
      .sort()[0];
    const name = countryName(iso2);
    const label = resourceLabel(resource);
    return makeChunk({
      id: chunkId('restriction', pair),
      facet: 'restriction',
      kind: 'country',
      entityIds: uniqueIds(countryId(iso2), resourceBottleneckIds(resource)),
      title: `${name} restricts ${label.toLowerCase()} exports`,
      text: `${name} restricts ${label.toLowerCase()} exports: ${measures.map(restrictionSummary).join('; ')}${since ? `; since ${since.slice(0, 4)}` : ''}. Recorded in the ${RESTRICTIONS_SOURCE.label}.`,
      href: `/resources/${resource}`,
      sourceUrl: measures.find((m) => m.link)?.link ?? RESTRICTIONS_SOURCE.url,
      evidence: 'sourced',
      ...(since ? { asOf: since } : {}),
      significance: shareOf(resource, iso2),
    });
  });
}
