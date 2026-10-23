import { RESOURCE_DIRECTORY_NOTE, resourceLabel, resourcesFor } from '@/config/substrata-resources';
import { entityId, type Entity } from '../types';
import { countryHeadline } from '@/lib/resources/headline';
import { countryNameOf, countryPages } from '@/lib/world/pages';

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

/**
 * One entity per country that has a profile page (lib/world/pages): the
 * directory's rows, every country a USGS/EIA table lists, every exporter in
 * the OECD inventory, the policy jurisdictions and the countries that host
 * a company. The href is the profile; the atlas sheet links to it.
 */
function countries(): Entity[] {
  return countryPages().map((iso2) => {
    const name = countryNameOf(iso2);
    const row = resourcesFor(iso2);
    // Computed facts lead; the directory sentence is kept, labelled, for
    // countries no production table lists.
    const facts = countryHeadline(iso2);
    const why = row?.why ?? '';
    const resources = row?.resources ?? [];
    const related = row?.relatedBottlenecks ?? [];
    return {
      id: entityId('country', iso2),
      kind: 'country' as const,
      key: iso2,
      name,
      aka: aliasesOf([iso2.toUpperCase()], name),
      href: `/world/${iso2}`,
      summary: facts ?? why ?? `${name} in the chain.`,
      evidence: facts ? 'computed from USGS and EIA tables' : 'directory, not a finding',
      sources: [],
      topics: ['country', iso2, ...resources],
      // "Directory cross-references" rather than "Related bottlenecks named in
      // the directory": every one of ~180 country rows repeated the word
      // "bottlenecks", which is exactly the kind of near-ubiquitous connector
      // that outscored the actual bottleneck entities in search. The names
      // that follow are the real cross-reference and stay.
      retrievalText: `${name} (${iso2.toUpperCase()}). ${facts ?? ''} Directory note: ${why} Directory resources: ${resources.map(resourceLabel).join(', ') || 'none listed'}. Directory cross-references: ${related.join(', ') || 'none yet'}. ${RESOURCE_DIRECTORY_NOTE}`,
    };
  });
}

export const source = { kind: 'country' as const, build: countries };
