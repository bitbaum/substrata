/**
 * Every entity in the corpus, projected once and indexed.
 *
 * Adapters live in `./sources`, one file per kind, and produce `Entity`.
 * Nothing else in the app builds an id or an href for a corpus object — search,
 * the assistant, the graph and the profile pages all read this, so they cannot
 * disagree about what exists or what it is called.
 */
import { ENTITY_SOURCES } from './sources';
import type { Entity, EntityKind } from './types';

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
  const all = ENTITY_SOURCES.flatMap((source) => source.build());
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

/**
 * The entity a page is about, from its path.
 *
 * This is what lets the assistant know what the reader is looking at. Without
 * it, asking "what are the other fields" on a company profile searched the
 * whole corpus and answered "Not in your data", because the question only makes
 * sense next to the page it was asked on.
 */
export function resolveByPath(path: string): Entity | undefined {
  const wanted = path.split('?')[0].split('#')[0].replace(/\/$/, '');
  if (!wanted || wanted === '/') return undefined;
  return entityIndex().all.find((entity) => entity.href.split('?')[0] === wanted);
}

/** What the index holds, for a status page and for the perf guard. */
export function indexStats(): { entities: number; kinds: number; labels: number } {
  const built = entityIndex();
  return { entities: built.all.length, kinds: built.byKind.size, labels: built.byLabel.size };
}
