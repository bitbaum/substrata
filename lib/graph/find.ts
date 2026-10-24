/**
 * From a name a reader typed to a graph node.
 *
 * Most firms in the graph have no entity of their own — they are minted from
 * the name a USGS table printed ("JV Inkai LLP") — so the directory's resolver
 * alone cannot find them. The order, most certain first:
 *
 * 1. the directory: a company, country or capital the site has a page for;
 * 2. a node whose name, without its legal forms, is exactly what was typed
 *    ("Inkai" is "JV Inkai LLP"; "Sumitomo" is "Sumitomo Corp.", not
 *    "Sumitomo Metal Mining Co. Ltd.");
 * 3. a node whose name holds every typed word, the fewest extra words first,
 *    then a company before a facility, then the best connected.
 *
 * Every other node that also matched is returned, so the answer can say so
 * rather than silently choose.
 */
import { resolveInDirectory } from '@/lib/entities/registry';
import { matchKey } from './alias-match';
import { canonicalId } from './aliases';
import { graphNode, graphStore, type GraphNode, type GraphStore } from './store';

export interface FoundNode {
  node: GraphNode;
  how: 'directory' | 'exact name' | 'words';
  /** Other nodes the words also fit, best first. */
  alsoMatched: GraphNode[];
}

interface Indexed {
  id: string;
  key: string;
  words: Set<string>;
  degree: number;
  kind: string;
  ownedBy: number;
  owning: number;
}

const indexes = new WeakMap<GraphStore, Indexed[]>();

function index(s: GraphStore): Indexed[] {
  const hit = indexes.get(s);
  if (hit) return hit;
  const ids = new Set<string>();
  for (const r of s.all) ids.add(r.from).add(r.to);
  const out = [...ids].map((id) => {
    const key = matchKey(graphNode(id, s).name);
    return {
      id,
      key,
      words: new Set(key.split(' ').filter(Boolean)),
      degree: (s.from.get(id)?.length ?? 0) + (s.to.get(id)?.length ?? 0),
      kind: id.slice(0, id.indexOf(':')),
      ownedBy: (s.to.get(id) ?? []).filter((r) => r.type === 'owns').length,
      owning: (s.from.get(id) ?? []).filter((r) => r.type === 'owns').length,
    };
  });
  indexes.set(s, out);
  return out;
}

const FILLER = new Set(['the', 'of', 'and', 'jv', 'joint', 'venture', 'company', 'group', 'mine']);
const KIND_ORDER = ['company', 'capital', 'country', 'facility'];

/**
 * What the question wants of the node, as a tie-break among word matches:
 * "who owns Collahuasi" wants the venture that HAS owners, not the Japanese
 * holding company whose name also carries the word.
 */
export type Prefer = 'owned' | 'owner';

/** The best node for a typed name, or null when nothing in the graph fits it. */
export function findGraphNode(
  typed: string,
  opts: { prefer?: Prefer } = {},
  s: GraphStore = graphStore(),
): FoundNode | null {
  const name = typed.replace(/\s+/g, ' ').trim();
  if (name.length < 2) return null;
  const nodes = index(s);
  const has = new Set(nodes.map((n) => n.id));
  for (const kind of ['company', 'country', 'capital'] as const) {
    const hit = resolveInDirectory(kind, name);
    if (hit && has.has(canonicalId(hit.id)))
      return { node: graphNode(canonicalId(hit.id), s), how: 'directory', alsoMatched: [] };
  }
  const key = matchKey(name);
  if (!key) return null;
  const fits = (n: Indexed) =>
    opts.prefer === 'owned' ? n.ownedBy > 0 : opts.prefer === 'owner' ? n.owning > 0 : true;
  const rank = (a: Indexed, b: Indexed) =>
    Number(fits(b)) - Number(fits(a)) ||
    a.words.size - b.words.size ||
    KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
    b.degree - a.degree;
  const exact = nodes.filter((n) => n.key === key).sort(rank);
  const words = key.split(' ').filter((w) => w.length > 1 && !FILLER.has(w));
  if (!exact.length && !words.length) return null;
  const containing = nodes
    .filter((n) => !exact.includes(n) && words.length && words.every((w) => n.words.has(w)))
    .sort(rank);
  const ranked = [...exact, ...containing];
  if (!ranked.length) return null;
  return {
    node: graphNode(ranked[0].id, s),
    how: exact.length ? 'exact name' : 'words',
    alsoMatched: ranked.slice(1, 5).map((n) => graphNode(n.id, s)),
  };
}
