import { FACILITIES, FACILITY_KIND_LABEL } from '@/config/substrata-facilities';
import { facilityHref } from '../../links';
import { entityId, type Entity } from '../types';

/**
 * Named places, as entities.
 *
 * The whole cost of a new kind, now that identity, relations, profiles,
 * discussion and the KPI traversal all read the registry: one adapter.
 */
function facilities(): Entity[] {
  return FACILITIES.map((facility) => ({
    id: entityId('facility', facility.id),
    kind: 'facility' as const,
    key: facility.id,
    name: facility.name,
    aka: [],
    href: facilityHref(facility.id),
    summary: `${FACILITY_KIND_LABEL[facility.kind]} in ${facility.where}.`,
    evidence: facility.primary ? 'named by a primary source' : 'named by a secondary source',
    sources: [facility.source],
    topics: ['facility', facility.kind, facility.place],
    retrievalText: `${facility.name} is a ${FACILITY_KIND_LABEL[facility.kind].toLowerCase()} in ${facility.where}${facility.operator ? `, operated by ${facility.operator}` : ''}. ${facility.what} It supplies: ${facility.makes.join(', ')}.`,
  }));
}

export const source = { kind: 'facility' as const, build: facilities };
