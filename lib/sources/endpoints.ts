/**
 * A name in a source, to a graph endpoint — or nothing. Never a guess: the
 * name must be a directory entity's name or alias, or (after dropping legal
 * suffixes such as "Corp." and "JSC") the one graph node with that name. Two
 * candidates, or none, is "unresolved", and the adapter reports the record as
 * skipped instead of picking.
 */
import { COUNTRIES } from '@/config/substrata-countries';
import { entitiesOfKind, resolveEntity, resolveIn } from '@/lib/entities/registry';
import usgsRelations from '../../research/usgs-relations.json';

const NODES = (usgsRelations as { nodes: Record<string, { name: string; kind: string }> }).nodes;

export { nameKey } from './name-key';
import { nameKey } from './name-key';

let byKey: Map<string, string[]> | null = null;

function nodeIndex(): Map<string, string[]> {
  if (byKey) return byKey;
  const index = new Map<string, string[]>();
  const add = (name: string, id: string) => {
    const key = nameKey(name);
    const ids = index.get(key) ?? [];
    if (key && !ids.includes(id)) index.set(key, [...ids, id]);
  };
  for (const e of entitiesOfKind('company')) for (const n of [e.name, ...e.aka]) add(n, e.id);
  for (const [id, node] of Object.entries(NODES)) if (node.kind === 'company') add(node.name, id);
  byKey = index;
  return index;
}

/**
 * Official long names the directory does not carry as aliases. A synonym
 * table, not a matcher: each line is the same country under its UN name.
 */
const OFFICIAL_NAMES: Record<string, string> = {
  'russian federation': 'ru',
  'united states': 'us',
  'united states of america': 'us',
  usa: 'us',
  "people's republic of china": 'cn',
  'republic of korea': 'kr',
  'united kingdom': 'gb',
  'czech republic': 'cz',
};

/** A country entity id from a name, or undefined. */
export function countryEndpoint(name: string): string | undefined {
  const direct = resolveIn('country', name)?.id;
  if (direct) return direct;
  const iso = OFFICIAL_NAMES[name.toLowerCase().trim()];
  return iso && resolveEntity(`country:${iso}`) ? `country:${iso}` : undefined;
}

/** A country entity id from an ISO 3166-1 alpha-2 code, when the site knows the country. */
export function countryByIso2(iso2: string): string | undefined {
  const code = iso2.toLowerCase();
  return COUNTRIES.some((c) => c.iso2 === code) && resolveEntity(`country:${code}`)
    ? `country:${code}`
    : undefined;
}

export type Resolution = { id: string } | { id: null; reason: string };

/** A company endpoint for `name`: a directory name or alias, else one unambiguous name match (directory or graph node). */
export function companyEndpoint(name: string): Resolution {
  const direct = resolveIn('company', name.trim())?.id;
  if (direct) return { id: direct };
  const hits = nodeIndex().get(nameKey(name)) ?? [];
  if (hits.length === 1) return { id: hits[0] };
  if (hits.length > 1)
    return { id: null, reason: `"${name}" matches ${hits.join(', ')}; not choosing` };
  return { id: null, reason: `"${name}" is not an entity on the site nor a graph node` };
}

/** Is `id` an endpoint a candidate row may name (lib/entry/vocab.ts graphEndpoint)? */
export function isEndpoint(id: string): boolean {
  return resolveEntity(id) !== undefined || id in NODES;
}
