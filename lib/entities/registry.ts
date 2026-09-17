/**
 * Every entity in the corpus, projected once.
 *
 * Adapters read `config/` and `lib/` and produce `Entity`. Nothing else in the
 * app builds an id or an href for a corpus object — search, the assistant, the
 * graph and the profile pages all read this, so they cannot disagree about what
 * exists or what it is called.
 *
 * Capital providers are here and were not in the old projection at all, which
 * is why a sourced development bank could not be found by search and the
 * assistant could not cite one.
 */
import { BOTTLENECKS } from '../bottlenecks';
import { MARKET_PARTICIPANTS } from '../participants';
import { allLearn, allNotes } from '../notes';
import {
  bottleneckHref,
  capitalHref,
  learnHref,
  marketHref,
  noteHref,
  policyHref,
  scienceHref,
} from '../links';
import { SCIENCE } from '@/config/substrata-science';
import { INSTRUMENTS } from '@/config/substrata-policy';
import { JOIN } from '@/config/substrata-join';
import { CAPITAL_KIND_LABEL, CAPITAL_PROVIDERS } from '@/config/substrata-capital';
import {
  COUNTRY_RESOURCES,
  RESOURCE_DIRECTORY_NOTE,
  resourceLabel,
} from '@/config/substrata-resources';
import { WORLD_PATHS } from '@/config/world-paths';
import { entityId, type Entity, type EntityKind } from './types';

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

function science(): Entity[] {
  return SCIENCE.map((s) => ({
    id: entityId('science', s.id),
    kind: 'science' as const,
    key: s.id,
    name: s.name,
    aka: [],
    href: scienceHref(s.id),
    summary: s.plain,
    evidence: s.source ? 'source-backed readiness judgement' : 'unsourced judgement',
    sources: s.source ? [s.source] : [],
    topics: [s.front, ...s.industries],
    retrievalText: `${s.plain} ${s.relieves.map((r) => `${r.bottleneck}: ${r.mechanism}`).join(' ')} Readiness ${s.readiness}/9: ${s.readinessWhy}. Analyst judgement dated ${s.judgedOn}. Next milestone: ${s.nextMilestone ?? 'not specified'}`,
  }));
}

function policy(): Entity[] {
  return INSTRUMENTS.map((i) => ({
    id: entityId('policy', i.id),
    kind: 'policy' as const,
    key: i.id,
    name: i.title,
    aka: [],
    href: policyHref(i.jurisdiction),
    summary: i.summary,
    evidence: i.primary ? 'primary source' : 'secondary source',
    sources: [i.source],
    topics: [...i.technologies, ...i.industries, i.jurisdiction],
    retrievalText: `${i.summary} ${i.body}. Status: ${i.status}; instrument date: ${i.date}; read on ${i.readOn}. ${i.statusNote ?? ''}`,
  }));
}

function talent(): Entity[] {
  return JOIN.roles.map((r, i) => ({
    id: entityId('talent', String(i)),
    kind: 'talent' as const,
    key: String(i),
    name: r.title,
    aka: [],
    href: '/talent',
    summary: r.what,
    evidence: 'project research need',
    sources: [],
    topics: ['talent'],
    retrievalText: `Research contribution opportunity, not employment. ${r.what} ${r.why}`,
  }));
}

function bottlenecks(): Entity[] {
  return BOTTLENECKS.map((b) => ({
    id: entityId('bottleneck', b.slug),
    kind: 'bottleneck' as const,
    key: b.slug,
    name: b.name,
    aka: [],
    href: bottleneckHref(b.slug),
    summary: b.plain,
    evidence: b.state,
    sources: [...new Set(b.producers.flatMap((p) => (p.source ? [p.source] : [])))],
    topics: [...b.technologies, b.stage, ...b.industries],
    retrievalText: `Explanation and analyst interpretation (not verified by the producer links): ${b.plain} ${b.why} ${b.rationale} Assessment ${b.binding}/12, judgement dated ${b.judgedOn}. Producer claims, each separately labelled: ${b.producers.map((p) => `${p.name}: ${p.verification}${p.source ? ` for making this material (${p.source})` : ''}`).join('; ')}. Producer pages do not establish total market share or the completeness of this list.`,
  }));
}

function companies(): Entity[] {
  return MARKET_PARTICIPANTS.map((p) => ({
    id: entityId('company', p.slug),
    kind: 'company' as const,
    key: p.slug,
    name: p.name,
    // The alias list existed in the data and was used by nothing, which is how
    // one firm spelled two ways stayed two firms.
    aka: aliasesOf((p as { aliases?: string[] }).aliases, p.name),
    href: marketHref(p.slug),
    summary: p.why ?? p.role ?? `An organisation recorded in the ${p.layer} layer.`,
    evidence: p.existenceVerifiedBy
      ? 'partly sourced; replaceability is a judgement'
      : 'unverified',
    sources: p.existenceVerifiedBy ? [p.existenceVerifiedBy.url] : [],
    topics: [...p.technologies, ...p.industries],
    retrievalText: `Directory interpretation, not independently verified: ${p.role ?? ''} ${p.why ?? ''} Jurisdictions recorded: ${p.jurisdictions.join(' ')}. Mapped products: ${p.produces.map((x) => `${x.bottleneck} (${x.verification})`).join(', ')}. ${p.existenceVerifiedBy ? `The source establishes only that this organisation makes ${p.existenceVerifiedBy.bottleneck}; it does not establish market share, rank, revenue, or replaceability.` : ''}`,
  }));
}

/** New to the projection: sourced capital providers were invisible to search and the assistant. */
function capital(): Entity[] {
  return CAPITAL_PROVIDERS.map((c) => ({
    id: entityId('capital', c.id),
    kind: 'capital' as const,
    key: c.id,
    name: c.name,
    aka: [],
    href: capitalHref(c.id),
    summary: c.mandate,
    evidence: c.primary ? 'primary source' : 'secondary source',
    sources: [c.source],
    topics: ['capital', c.kind, c.jurisdiction],
    retrievalText: `${c.name} is ${CAPITAL_KIND_LABEL[c.kind]} in ${c.jurisdiction.toUpperCase()}. Mandate: ${c.mandate} Its own words: "${c.quote}" (read ${c.readOn}). Bottlenecks its mandate could fund relief for: ${c.canMove.join(', ')}. A mandate covering an asset is not a claim that it has funded one.`,
  }));
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

function learn(): Entity[] {
  return allLearn().map((n) => ({
    id: entityId('learn', n.slug),
    kind: 'learn' as const,
    key: n.slug,
    name: n.title,
    aka: [],
    href: learnHref(n.slug),
    summary: n.summary,
    evidence: 'explanation',
    sources: [],
    topics: n.tags,
    retrievalText: n.summary,
  }));
}

function articles(): Entity[] {
  return allNotes().map((n) => ({
    id: entityId('article', n.slug),
    kind: 'article' as const,
    key: n.slug,
    name: n.title,
    aka: [],
    href: noteHref(n.slug),
    summary: n.summary,
    evidence: 'editorial',
    sources: [],
    topics: n.tags,
    retrievalText: n.summary,
  }));
}

/** Every entity, in a stable order. Cheap enough to call per request; memoise if that changes. */
/**
 * The corpus, built once and indexed.
 *
 * This is derived from static config, so it cannot change within a process, and
 * rebuilding it per call was costing 22ms — on every call, including every one
 * of the lookups below, which then linear-scanned the result. A single entity
 * lookup cost 19ms. That is invisible at 268 entities and fatal at ten times
 * that: the cost is the rebuild multiplied by the scan, so it grows with the
 * square of the corpus while feeling fine right up until it does not.
 *
 * Built eagerly on first use, then served from maps.
 */
interface EntityIndex {
  all: Entity[];
  byId: Map<string, Entity>;
  byKind: Map<EntityKind, Entity[]>;
  /** `kind:lowercased name-or-alias-or-key` → entity, for tolerant resolution. */
  byLabel: Map<string, Entity>;
}

let index: EntityIndex | null = null;

function buildIndex(): EntityIndex {
  const all = [
    ...science(),
    ...policy(),
    ...talent(),
    ...bottlenecks(),
    ...companies(),
    ...capital(),
    ...learn(),
    ...countries(),
    ...articles(),
  ];
  const byId = new Map<string, Entity>();
  const byKind = new Map<EntityKind, Entity[]>();
  const byLabel = new Map<string, Entity>();
  for (const entity of all) {
    byId.set(entity.id, entity);
    const kind = byKind.get(entity.kind);
    if (kind) kind.push(entity);
    else byKind.set(entity.kind, [entity]);
    // First writer wins, so a later alias collision cannot silently displace a
    // real key — the entity test holds ids unique, aliases are best effort.
    for (const label of [entity.key, entity.name, ...entity.aka]) {
      const at = `${entity.kind}:${label.toLowerCase()}`;
      if (!byLabel.has(at)) byLabel.set(at, entity);
    }
  }
  return { all, byId, byKind, byLabel };
}

function entityIndex(): EntityIndex {
  if (!index) index = buildIndex();
  return index;
}

/** Every entity, in a stable order. */
export function allEntities(): Entity[] {
  return entityIndex().all;
}

export function entitiesOfKind(kind: Entity['kind']): Entity[] {
  return entityIndex().byKind.get(kind) ?? [];
}

/** Resolve by full id (`company:posco`). Returns undefined rather than throwing: callers render a gap. */
export function resolveEntity(id: string): Entity | undefined {
  return entityIndex().byId.get(id);
}

/** Resolve within a kind, tolerating the name as well as the key, via `aka`. */
export function resolveIn(kind: Entity['kind'], keyOrName: string): Entity | undefined {
  return entityIndex().byLabel.get(`${kind}:${keyOrName.toLowerCase()}`);
}

/** What the index holds, for a status page and for the perf guard. */
export function indexStats(): { entities: number; kinds: number; labels: number } {
  const built = entityIndex();
  return { entities: built.all.length, kinds: built.byKind.size, labels: built.byLabel.size };
}
