/**
 * One bottleneck as a flow: what it needs, the thing itself, who makes it
 * and where, and what it holds up.
 *
 * Nothing here is new data. "Needs" and "holds up" are the dependency edges of
 * the graph (config/substrata-dependencies.ts via lib/graph); makers are the
 * bottleneck's producer rows; technologies are its classification. This file
 * only arranges them in the order a supply chain reads.
 *
 * Every node stays on the map. A maker used to link out to its /markets page,
 * so reading "who builds this" meant leaving the chain and pressing Back
 * (owner, 2026-10-12); now a maker opens in the atlas' own panel, and the
 * profile is one link further for whoever wants the whole dossier.
 */
import { TECHNOLOGIES, type TechnologyId } from '@/config/substrata-taxonomy';
import { CHAIN_LAYERS, SCARCITY_LABEL } from '@/config/substrata-participants';
import { VERIFICATION_LABEL, type Verification } from '@/config/substrata-evidence';
import { BOTTLENECKS, type Bottleneck, type BottleneckProducer } from '@/lib/bottlenecks';
import { neighbors } from '@/lib/graph';
import { hasMarketPage, participantBySlug } from '@/lib/participants';
import { marketHref, slugify } from '@/lib/links';

export interface FlowNode {
  label: string;
  href: string;
  /** A second line: a role, a country, a verification state. */
  note?: string;
  /** Makers only: the role on the chain, as the card's chip. */
  role?: string;
  /** Makers only: supplies a part rather than building the thing. */
  supplier?: boolean;
  /** Makers only: the slug `?maker=` selects. */
  makerSlug?: string;
  /** Makers only: the country codes behind `note`, for prose. */
  noteIsos?: string[];
}

export interface ChainFlow {
  needs: FlowNode[];
  makers: FlowNode[];
  /** Where the makers and the thing sit, for the jump to the world view. */
  places: { iso2: string; name: string; href: string }[];
  feeds: FlowNode[];
  technologies: FlowNode[];
}

/** One maker as the panel shows it, inside the chain rather than on its own page. */
export interface MakerDetail {
  slug: string;
  name: string;
  role: string;
  supplier: boolean;
  countries: string[];
  verification: Verification;
  verificationLabel: string;
  source: string | null;
  /** The directory's one-line role and its scarcity judgement, when the maker has a row. */
  directory: {
    role: string | null;
    why: string | null;
    scarcity: string | null;
    layer: string | null;
  } | null;
  /** The full profile, when one exists. */
  profileHref: string | null;
}

const SLUGS = new Set(BOTTLENECKS.map((b) => b.slug));
const REGION = new Intl.DisplayNames(['en'], { type: 'region' });

export function countryName(iso2: string): string {
  try {
    return REGION.of(iso2.toUpperCase()) ?? iso2.toUpperCase();
  } catch {
    return iso2.toUpperCase();
  }
}

/** Countries English names with "the": "made in the Netherlands", not "in Netherlands". */
const WITH_THE = new Set([
  'nl',
  'us',
  'gb',
  'ph',
  'cd',
  'cf',
  'do',
  'ae',
  'bs',
  'gm',
  'mv',
  'mh',
  'sb',
  'km',
  'va',
]);

/** A country as it reads mid-sentence. */
export function countryInProse(iso2: string): string {
  const name = countryName(iso2);
  return WITH_THE.has(iso2.toLowerCase()) ? `the ${name}` : name;
}

export function chainHref(slug: string, topic?: string, maker?: string, lens?: string): string {
  const params = new URLSearchParams();
  if (topic) params.set('topic', topic);
  params.set('chain', slug);
  if (maker) params.set('maker', maker);
  // The overview is the default; a lens the reader chose rides along as they walk the chain.
  if (lens && lens !== 'overview') params.set('lens', lens);
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

/** Makers before part suppliers: Zeiss supplying optics is not a second scanner maker. */
function orderedProducers(chain: Bottleneck): BottleneckProducer[] {
  return [...chain.producers].sort((a, b) => Number(a.supplier) - Number(b.supplier));
}

export function chainFlow(chain: Bottleneck, topic: string): ChainFlow {
  const producers = orderedProducers(chain);
  const isos = [
    ...new Set([...chain.jurisdictions, ...producers.flatMap((p) => p.jurisdictions)]),
  ].map((code) => code.toLowerCase());
  return {
    needs: dependencyNodes(chain, 'depends on', topic),
    makers: producers.map((p) => ({
      label: p.name,
      href: chainHref(chain.slug, topic, slugify(p.name)),
      makerSlug: slugify(p.name),
      role: p.role,
      supplier: p.supplier,
      note: p.jurisdictions.map(countryName).join(' · '),
      noteIsos: p.jurisdictions.map((c) => c.toLowerCase()),
    })),
    places: isos.map((iso2) => ({ iso2, name: countryName(iso2), href: countryHref(iso2) })),
    feeds: dependencyNodes(chain, 'depended on by', topic),
    technologies: TECHNOLOGIES.filter((t) => chain.technologies.includes(t.id)).map((t) => ({
      label: t.name,
      href: `/atlas?topic=${t.id}`,
    })),
  };
}

/** The maker `?maker=` names on this chain, or null when it names nobody here. */
export function makerDetail(chain: Bottleneck, slug: string | undefined): MakerDetail | null {
  if (!slug) return null;
  const producer = chain.producers.find((p) => slugify(p.name) === slug);
  if (!producer) return null;
  const row = participantBySlug(slug);
  const layer = row ? (CHAIN_LAYERS.find((l) => l.id === row.layer)?.name ?? null) : null;
  return {
    slug,
    name: producer.name,
    role: producer.role,
    supplier: producer.supplier,
    countries: producer.jurisdictions.map(countryName),
    verification: producer.verification,
    verificationLabel: VERIFICATION_LABEL[producer.verification],
    source: producer.source,
    directory: row
      ? {
          role: row.role,
          why: row.why,
          scarcity: row.scarcity ? SCARCITY_LABEL[row.scarcity] : null,
          layer,
        }
      : null,
    profileHref: hasMarketPage(slug) ? marketHref(slug) : null,
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
