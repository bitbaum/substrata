/**
 * Company stubs: organisations the relation graph names that the directory
 * holds no profile for.
 *
 * The USGS yearbook tables print hundreds of operators and owners — NAC
 * Kazatomprom JSC, JV Inkai LLP, Uranium One Inc. — and the graph mints a
 * `company:<slug>` endpoint for each (lib/graph/parties.ts). Without an
 * entity, a question about Kazatomprom found nothing to link, and an event or
 * a relation could not name it as a participant with a page.
 *
 * A stub is built, never written: any minted `company:` node that a counted
 * relation (`stated` or `corroborated`) touches becomes one, at build time,
 * from the graph. It says nothing the relations do not: its name as the source
 * printed it, the country of the table that printed it, and "Named in <source>
 * as operator of …". Its evidence is `stub`, so search ranks it below a
 * profiled company and the page says plainly that no profile is held.
 */
import { graphNode, graphStore, isCounted, type Relation } from '@/lib/graph/index';
import { printedAs } from '@/lib/graph/aliases';
import { countryNameOf } from '@/lib/world/pages';
import { marketHref } from '../../links';
import { STUB_EVIDENCE, type Entity, type EntityId } from '../types';

/** Counted relations touching `id`, both directions, in id order. */
export function stubRelations(id: string): Relation[] {
  const s = graphStore();
  return [...(s.from.get(id) ?? []), ...(s.to.get(id) ?? [])]
    .filter(isCounted)
    .sort((a, b) => a.id.localeCompare(b.id));
}

const USGS_YEARBOOK = /pubs\.usgs\.gov\/myb\/vol3\/(\d{4})\/myb3-\d{4}-([a-z-]+)\./;

/** A source URL as a sentence can name it: the yearbook chapter, else the site. */
export function sourceLabel(url: string): string {
  const usgs = url.match(USGS_YEARBOOK);
  if (usgs) {
    const country = usgs[2]
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    return `the USGS Minerals Yearbook ${usgs[1]} (${country})`;
  }
  try {
    return `a page on ${new URL(url).hostname.replace(/^www\./, '')}`;
  } catch {
    return url;
  }
}

function list(names: string[]): string {
  const unique = [...new Set(names)];
  const shown = unique.slice(0, 3);
  const more = unique.length - shown.length;
  const head = shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${shown.at(-1)}` : shown[0];
  return more > 0 ? `${shown.join(', ')} and ${more} more` : head;
}

/**
 * The other ends, by name. A USGS site is named by the place list its row
 * printed, often a paragraph, so sites are counted rather than quoted: the
 * page lists each one with its cell.
 */
function named(ids: string[]): string {
  const sites = new Set(ids.filter((id) => id.startsWith('facility:')));
  const others = ids.filter((id) => !sites.has(id)).map((id) => graphNode(id).name);
  const parts = [...(others.length ? [list(others)] : [])];
  if (sites.size) parts.push(sites.size === 1 ? 'one listed site' : `${sites.size} listed sites`);
  return parts.join(' and ');
}

const ROLE: Partial<Record<Relation['type'], { out: string; in: string }>> = {
  operates: { out: 'operator of', in: 'operated by' },
  owns: { out: 'holder of a stake in', in: 'held by' },
  finances: { out: 'financer of', in: 'financed by' },
  supplies: { out: 'supplier to', in: 'supplied by' },
  buys_from: { out: 'buyer from', in: 'seller to' },
  ships_to: { out: 'shipper to', in: 'receiving from' },
};

/** "Named in the USGS Minerals Yearbook 2023 (Kazakhstan) as operator of A and holder of a stake in B." */
export function stubSummary(id: string, relations: Relation[] = stubRelations(id)): string {
  const roles: string[] = [];
  for (const [type, words] of Object.entries(ROLE) as [
    Relation['type'],
    { out: string; in: string },
  ][]) {
    const out = relations.filter((r) => r.type === type && r.from === id);
    const into = relations.filter((r) => r.type === type && r.to === id);
    if (out.length) roles.push(`${words.out} ${named(out.map((r) => r.to))}`);
    if (into.length) roles.push(`${words.in} ${named(into.map((r) => r.from))}`);
  }
  const sources = [
    ...new Set(relations.flatMap((r) => r.evidence.map((e) => sourceLabel(e.source)))),
  ];
  const where =
    sources.length > 1
      ? `${sources[0]} and ${sources.length - 1} other source${sources.length > 2 ? 's' : ''}`
      : sources[0];
  return `Named in ${where} as ${roles.length ? list(roles) : 'a party to a relation'}.`;
}

function stub(id: EntityId): Entity {
  const node = graphNode(id);
  const relations = stubRelations(id);
  const summary = stubSummary(id, relations);
  const key = id.slice('company:'.length);
  const countries = node.iso2.map(countryNameOf);
  const where = countries.length
    ? `Printed in the ${countries.join(' and ')} table${countries.length > 1 ? 's' : ''}.`
    : 'No source states a country.';
  return {
    id,
    kind: 'company',
    key,
    name: node.name,
    aka: printedAs(id).filter((spelling) => spelling !== node.name),
    href: marketHref(key),
    summary,
    evidence: STUB_EVIDENCE,
    sources: [...new Set(relations.flatMap((r) => r.evidence.map((e) => e.source)))],
    topics: ['company', ...node.iso2, ...(node.commodities ?? [])],
    retrievalText: `${node.name}: no profile is held for this organisation; only what published sources say about it is recorded. ${summary} ${where}${node.commodities?.length ? ` Commodities in its rows: ${node.commodities.join(', ')}.` : ''}`,
  };
}

/** Every minted `company:` node a counted relation touches, as a stub, in id order. */
function companyStubs(): Entity[] {
  const s = graphStore();
  const ids = new Set<EntityId>();
  for (const r of s.all) {
    if (!isCounted(r)) continue;
    for (const id of [r.from, r.to])
      if (id.startsWith('company:') && !graphNode(id, s).inDirectory) ids.add(id);
  }
  return [...ids].sort().map(stub);
}

export const source = { kind: 'company' as const, build: companyStubs };
