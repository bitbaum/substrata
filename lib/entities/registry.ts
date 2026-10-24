/**
 * Every entity in the corpus, projected once and indexed.
 *
 * Adapters live in `./sources`, one file per kind, and produce `Entity`.
 * Nothing else in the app builds an id or an href for a corpus object — search,
 * the assistant, the graph and the profile pages all read this, so they cannot
 * disagree about what exists or what it is called.
 */
import { DERIVED_SOURCES, ENTITY_SOURCES } from './sources';
import { isStub, type Entity, type EntityKind } from './types';

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

/**
 * A label as the index keys it: lower case, with the Turkish dotted and
 * dotless i folded to "i" — "Bakır".toUpperCase().toLowerCase() is "bakir",
 * so without this a yearbook name typed in capitals resolves to nothing.
 */
function labelKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/\u0307/g, '');
}

function indexOf(all: Entity[]): EntityIndex {
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
      const at = `${entity.kind}:${labelKey(label)}`;
      if (!byLabel.has(at)) byLabel.set(at, entity);
    }
  }
  return { all, byId, byKind, byLabel };
}

/**
 * Two passes. The directory first; then the derived sources (company stubs),
 * which read the relation graph — and the graph's producers resolve the names
 * they print against the directory. So the directory is installed before the
 * derived pass runs, and a graph built during that pass sees exactly the
 * directory, never a half-built index. A derived entity never displaces a
 * directory one: ids are checked unique by test/entities.test.ts, and labels
 * are first-writer-wins.
 */
function entityIndex(): EntityIndex {
  if (!index) {
    const directory = ENTITY_SOURCES.flatMap((source) => source.build());
    index = indexOf(directory);
    const derived = DERIVED_SOURCES.flatMap((source) => source.build());
    if (derived.length) index = indexOf([...directory, ...derived]);
  }
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
  return entityIndex().byLabel.get(`${kind}:${labelKey(keyOrName)}`);
}

/**
 * The same, but only an entity the corpus profiles: a stub (a firm known only
 * from the relations that name it) does not answer. The graph's producers use
 * this, so the graph a stub is derived from never depends on whether the stubs
 * were built yet.
 */
export function resolveInDirectory(kind: Entity['kind'], keyOrName: string): Entity | undefined {
  const hit = resolveIn(kind, keyOrName);
  return hit && !isStub(hit) ? hit : undefined;
}

/** Resolve by id, profiled entities only (see `resolveInDirectory`). */
export function resolveDirectoryEntity(id: string): Entity | undefined {
  const hit = resolveEntity(id);
  return hit && !isStub(hit) ? hit : undefined;
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
