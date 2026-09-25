/**
 * One bottleneck as a left-to-right flow: what it needs, the thing itself,
 * who makes it and where, and what it holds up.
 *
 * Nothing here is new data. "Needs" and "holds up" are the dependency edges of
 * the graph (config/substrata-dependencies.ts via lib/graph); makers are the
 * bottleneck's producer rows; technologies are its classification. This file
 * only arranges them in the order a supply chain reads.
 */
import { TECHNOLOGIES, type TechnologyId } from '@/config/substrata-taxonomy';
import { BOTTLENECKS, type Bottleneck } from '@/lib/bottlenecks';
import { neighbors } from '@/lib/graph';
import { marketHref } from '@/lib/links';

export interface FlowNode {
  label: string;
  href: string;
  /** A second line: a role, a country, a verification state. */
  note?: string;
}

export interface ChainFlow {
  needs: FlowNode[];
  makers: FlowNode[];
  /** Where the makers and the thing sit, for the jump to the world view. */
  places: { iso2: string; name: string; href: string }[];
  feeds: FlowNode[];
  technologies: FlowNode[];
}

const SLUGS = new Set(BOTTLENECKS.map((b) => b.slug));
const REGION = new Intl.DisplayNames(['en'], { type: 'region' });

function countryName(iso2: string): string {
  try {
    return REGION.of(iso2.toUpperCase()) ?? iso2.toUpperCase();
  } catch {
    return iso2.toUpperCase();
  }
}

export function chainHref(slug: string, topic?: string): string {
  const params = new URLSearchParams();
  if (topic) params.set('topic', topic);
  params.set('chain', slug);
  return `/atlas?${params.toString()}`;
}

export function countryHref(iso2: string, resource?: string): string {
  const params = new URLSearchParams({ view: 'world', country: iso2.toLowerCase() });
  if (resource) params.set('resource', resource);
  return `/atlas?${params.toString()}`;
}

function dependencyNodes(chain: Bottleneck, rel: string, topic: string): FlowNode[] {
  return neighbors('bottleneck', chain.slug)
    .filter((edge) => edge.rel === rel && edge.to.kind === 'bottleneck')
    .map((edge) => ({
      label: edge.to.label,
      // Walk the chain inside the atlas when we can; the dossier otherwise.
      href: SLUGS.has(edge.to.id) ? chainHref(edge.to.id, topic) : edge.to.href,
    }));
}

export function chainFlow(chain: Bottleneck, topic: string): ChainFlow {
  // Makers before part suppliers: Zeiss supplying optics is not a second scanner maker.
  const producers = [...chain.producers].sort((a, b) => Number(a.supplier) - Number(b.supplier));
  const isos = [
    ...new Set([...chain.jurisdictions, ...producers.flatMap((p) => p.jurisdictions)]),
  ].map((code) => code.toLowerCase());
  return {
    needs: dependencyNodes(chain, 'depends on', topic),
    makers: producers.map((p) => ({
      label: p.name,
      href: marketHref(p.name),
      note: [p.jurisdictions.join(' · '), p.verification].filter(Boolean).join(' — '),
    })),
    places: isos.map((iso2) => ({ iso2, name: countryName(iso2), href: countryHref(iso2) })),
    feeds: dependencyNodes(chain, 'depended on by', topic),
    technologies: TECHNOLOGIES.filter((t) => chain.technologies.includes(t.id)).map((t) => ({
      label: t.name,
      href: `/atlas?topic=${t.id}`,
    })),
  };
}

/** The bottlenecks a reader may pick, narrowed by technology when one is set. */
export function pickable(topic: string): readonly Bottleneck[] {
  return topic
    ? BOTTLENECKS.filter((b) => b.technologies.includes(topic as TechnologyId))
    : BOTTLENECKS;
}

/** The requested chain, else the first with makers on record, else the first. */
export function resolveChain(topic: string, requested?: string): Bottleneck {
  const listed = pickable(topic);
  return (
    listed.find((b) => b.slug === requested) ??
    listed.find((b) => b.producers.length > 0) ??
    listed[0] ??
    BOTTLENECKS[0]
  );
}
