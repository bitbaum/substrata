import {
  COUNTRY_RESOURCES,
  RESOURCE_DIRECTORY_NOTE,
  resourceLabel,
} from '@/config/substrata-resources';
import { WORLD_PATHS } from '@/config/world-paths';
import { entityId, type Entity } from '../types';
function countryName(iso2: string): string {
  return WORLD_PATHS.find((p) => p.iso2 === iso2)?.name ?? iso2.toUpperCase();
}

/**
 * Alternative spellings, minus the name itself and minus duplicates.
 *
 * A country with no display name falls back to its ISO code, which made the
 * code both the name and its own alias — harmless-looking, and exactly the kind
 * of self-referential join that makes "same organisation?" unanswerable.
 */
function aliasesOf(aliases: string[] | undefined, name: string): string[] {
  return [...new Set(aliases ?? [])].filter((alias) => alias && alias !== name);
}

function countries(): Entity[] {
  return COUNTRY_RESOURCES.map((row) => {
    const name = countryName(row.iso2);
    return {
      id: entityId('country', row.iso2),
      kind: 'country' as const,
      key: row.iso2,
      name,
      aka: aliasesOf([row.iso2.toUpperCase()], name),
      href: `/atlas?view=world&country=${row.iso2}`,
      summary: row.why,
      evidence: 'directory, not a finding',
      sources: [],
      topics: ['country', row.iso2, ...row.resources],
      retrievalText: `${name} (${row.iso2.toUpperCase()}). ${row.why} Directory resources: ${row.resources.map(resourceLabel).join(', ') || 'none listed'}. Related bottlenecks named in the directory: ${row.relatedBottlenecks.join(', ') || 'none yet'}. ${RESOURCE_DIRECTORY_NOTE}`,
    };
  });
}

export const source = { kind: 'country' as const, build: countries };
