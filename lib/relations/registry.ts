/**
 * Every relation in the corpus, derived once.
 *
 * Facts stay in `config/`; identity stays in `lib/entities`. This layer owns
 * only the joins between them, and every join carries its own evidence, because
 * "who makes this" is a claim in exactly the way "this company exists" is.
 */
import { BOTTLENECKS } from '../bottlenecks';
import { MARKET_PARTICIPANTS } from '../participants';
import { SCIENCE } from '@/config/substrata-science';
import { CAPITAL_PROVIDERS } from '@/config/substrata-capital';
import { INSTRUMENTS } from '@/config/substrata-policy';
import { COUNTRY_RESOURCES } from '@/config/substrata-resources';
import { RESEARCH_PROGRAMMES } from '@/config/substrata-programmes';
import { entityId, type Entity, type EntityId } from '../entities/types';
import { resolveEntity } from '../entities/registry';
import { RELATION_LABEL, type Connection, type Relation } from './types';

/** A join the directory asserts but nothing verifies. Said out loud, every time. */
const DIRECTORY = 'directory join, not a sourced finding';

function bottleneckId(name: string): EntityId | null {
  const b = BOTTLENECKS.find((row) => row.name === name);
  return b ? entityId('bottleneck', b.slug) : null;
}

/** Only countries the corpus actually holds a row for become entities. */
function countryId(code: string): EntityId | null {
  const iso = code.toLowerCase();
  return COUNTRY_RESOURCES.some((r) => r.iso2 === iso) ? entityId('country', iso) : null;
}

let cache: Relation[] | null = null;

export function allRelations(): Relation[] {
  if (cache) return cache;
  const relations: Relation[] = [];
  const add = (
    kind: Relation['kind'],
    from: EntityId | null,
    to: EntityId | null,
    evidence: string,
    sources: string[] = [],
  ) => {
    if (from && to) relations.push({ kind, from, to, evidence, sources });
  };

  for (const company of MARKET_PARTICIPANTS) {
    const from = entityId('company', company.slug);
    for (const row of company.produces) {
      // The producer row's own three-valued state, carried onto the join. This
      // is the whole point: an unverified lead must not render like a finding.
      add(
        'produces',
        from,
        bottleneckId(row.bottleneck),
        row.source ? 'sourced' : row.verification,
        row.source ? [row.source] : [],
      );
    }
    for (const code of company.jurisdictions) {
      add('located-in', from, countryId(code), DIRECTORY);
    }
  }

  for (const entry of SCIENCE) {
    const to = entityId('science', entry.id);
    for (const relief of entry.relieves) {
      add(
        'relieved-by',
        bottleneckId(relief.bottleneck),
        to,
        entry.source ? 'source-backed readiness judgement' : 'unsourced judgement',
        entry.source ? [entry.source] : [],
      );
    }
  }

  for (const provider of CAPITAL_PROVIDERS) {
    const to = entityId('capital', provider.id);
    for (const name of provider.canMove) {
      add('fundable-by', bottleneckId(name), to, 'mandate covers the asset; not a funded deal', [
        provider.source,
      ]);
    }
  }

  for (const instrument of INSTRUMENTS) {
    // A policy instrument is a policy entity. The old graph emitted it with
    // `kind: 'capital'`, so rules appeared as capital on country dossiers.
    const to = entityId('policy', instrument.id);
    const evidence = instrument.primary ? 'primary source' : 'secondary source';
    for (const name of instrument.bottlenecks) {
      add('governed-by', bottleneckId(name), to, evidence, [instrument.source]);
    }
    add('in-force-in', to, countryId(instrument.jurisdiction), evidence, [instrument.source]);
  }

  for (const programme of RESEARCH_PROGRAMMES) {
    for (const layer of programme.layers) {
      const to = entityId('loop', layer.id);
      for (const name of layer.gatedBy) {
        // The loop is the thing everything else serves, so this is the edge that
        // makes the web answer "why does this matter" rather than only "what is
        // next to this". It is the project's model, and says so.
        add('gates', bottleneckId(name), to, "the project's own model, not a measurement");
      }
    }
  }

  for (const row of COUNTRY_RESOURCES) {
    const from = entityId('country', row.iso2);
    for (const name of row.relatedBottlenecks) {
      add('endowed-with', from, bottleneckId(name), DIRECTORY);
    }
  }

  cache = relations;
  return relations;
}

/**
 * Connections, indexed by endpoint.
 *
 * Reading a profile asks "what touches this", so the question is asked once per
 * entity per render. Scanning every relation each time is linear in the size of
 * the whole web to answer a question about one node — the cost grows with the
 * graph even for entities that touch nothing.
 *
 * Both directions are materialised once, which is also what makes the single
 * declaration safe: the forward and inverse readings are produced together from
 * the same relation, so they cannot diverge.
 */
let byEndpoint: Map<EntityId, Connection[]> | null = null;

function connectionIndex(): Map<EntityId, Connection[]> {
  if (byEndpoint) return byEndpoint;
  const index = new Map<EntityId, Connection[]>();
  const put = (at: EntityId, connection: Connection) => {
    const list = index.get(at);
    if (list) list.push(connection);
    else index.set(at, [connection]);
  };
  for (const relation of allRelations()) {
    put(relation.from, {
      kind: relation.kind,
      other: relation.to,
      label: RELATION_LABEL[relation.kind].forward,
      evidence: relation.evidence,
      sources: relation.sources,
    });
    put(relation.to, {
      kind: relation.kind,
      other: relation.from,
      label: RELATION_LABEL[relation.kind].inverse,
      evidence: relation.evidence,
      sources: relation.sources,
    });
  }
  byEndpoint = index;
  return index;
}

/**
 * Everything joined to an entity, read from its end.
 *
 * Both directions come from the single declaration, so a company's "makes" and
 * a bottleneck's "produced by" are guaranteed to be the same fact.
 */
export function connectionsOf(id: EntityId): Connection[] {
  return connectionIndex().get(id) ?? [];
}

/** What the relation index holds, for a status page and the perf guard. */
export function relationStats(): { relations: number; endpoints: number } {
  return { relations: allRelations().length, endpoints: connectionIndex().size };
}

/** A connection with the other end resolved, for rendering. */
export interface ResolvedConnection extends Connection {
  entity: Entity;
}

export function resolvedConnectionsOf(id: EntityId): ResolvedConnection[] {
  return connectionsOf(id).flatMap((connection) => {
    const entity = resolveEntity(connection.other);
    return entity ? [{ ...connection, entity }] : [];
  });
}
