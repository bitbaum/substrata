/**
 * `how_connected`: the chains of relations between two things, each link with
 * its evidence. The far end may be a country and a resource ("Kazakh
 * uranium"): then it is every facility the USGS tables print there for that
 * resource, and a chain ends at whichever it reaches first.
 */
import { entitiesOfKind, resolveIn } from '../entities/registry';
import type { EntityId } from '../entities/types';
import { findGraphNode } from '../graph/find';
import { graphStore, pathsBetween, type Relation } from '../graph/index';
import type { ToolEnv } from './ledger';
import { relationRow, rememberNode } from './graph-rows';
import { producerResource } from './producers';
import { num, str, type Args } from './tool';

const MAX_PATHS = 6;

/** A country from its name or the adjective a reader uses ("Kazakh", "Chilean"). */
export function countryFrom(text: string): { id: EntityId; key: string; name: string } | undefined {
  const exact = resolveIn('country', text);
  if (exact) return { id: exact.id, key: exact.key, name: exact.name };
  const words = text.toLowerCase().match(/[a-zà-ÿ]{5,}/g) ?? [];
  for (const c of entitiesOfKind('country')) {
    const name = c.name.toLowerCase();
    if (words.some((w) => name.startsWith(w) || w.startsWith(name)))
      return { id: c.id, key: c.key, name: c.name };
  }
  return undefined;
}

/** The facilities the graph knows in a country, for a resource when one is named. */
function facilitiesIn(iso2: string, resource?: string): EntityId[] {
  const word = resource?.replace(/-/g, ' ').replace(/s$/, '');
  const out: EntityId[] = [];
  for (const [id, node] of graphStore().nodes) {
    if (!id.startsWith('facility:') || !node.iso2.includes(iso2)) continue;
    if (word && !(node.commodities ?? []).some((c) => c.toLowerCase().includes(word))) continue;
    out.push(id as EntityId);
  }
  return out;
}

function chainText(path: Relation[]): string {
  return path.map((r) => relationRow(r, r.from).relation).join(' → ');
}

export async function connections(a: Args, env: ToolEnv, note: string) {
  const from = findGraphNode(str(a.a), { prefer: 'owner' });
  if (!from)
    return { error: `No company or venture called "${str(a.a)}" is in the relation graph.` };
  const typedB = str(a.b);
  const resource = producerResource(str(a.resource) || typedB);
  // A firm named outright wins; a country or its adjective ("Kazakh uranium") means its facilities.
  const named = findGraphNode(typedB, { prefer: 'owned' });
  const firm = named && named.node.kind !== 'country' && named.how !== 'words';
  const country = firm ? undefined : countryFrom(typedB);
  const direct = country ? null : named;
  const targets: EntityId[] = country
    ? [...facilitiesIn(country.key, resource), country.id]
    : direct
      ? [direct.node.id]
      : [];
  if (!targets.length)
    return { error: `Nothing called "${typedB}" is in the relation graph.`, a: from.node.name };
  const maxHops = num(a.max_hops, 3, 1, 4);
  const seen = new Set<string>();
  const paths = targets
    .flatMap((t) => pathsBetween(from.node.id, t, { maxHops, limit: 4 }))
    .sort((x, y) => x.length - y.length)
    .filter((p) => {
      const key = p.map((r) => r.id).join('>');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_PATHS);
  rememberNode(env, from.node);
  if (direct) rememberNode(env, direct.node);
  const label = country
    ? `${country.name}${resource ? ` (${resource.replace(/-/g, ' ')} facilities)` : ''}`
    : direct!.node.name;
  return {
    a: from.node.name,
    b: label,
    ...(from.alsoMatched.length ? { a_also_matched: from.alsoMatched.map((n) => n.name) } : {}),
    paths: paths.map((p) => ({
      hops: p.length,
      chain: chainText(p),
      counted: p.every((r) => r.grade === 'stated' || r.grade === 'corroborated'),
      links: p.map((r) => relationRow(r, r.from)),
    })),
    ...(paths.length
      ? {}
      : {
          none: `No chain of at most ${maxHops} relations joins ${from.node.name} to ${label} in the graph. That is a gap in the graph, not proof that no link exists.`,
        }),
    note: `${note} A chain is only as strong as its weakest link: say a chain with an unverified lead in it is unverified. A facility named "Locations: …" is one USGS row listing several sites, not one site.`,
  };
}
