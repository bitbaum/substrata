/**
 * Connecting the dots: three inference rules over the relation graph.
 *
 * Each rule is a pure function of a graph store and returns PROPOSALS — new
 * relations graded `derived` or `lead`, never `stated` — each naming the rule
 * that fired and the relation ids it follows from. They are written to
 * `research/derived-relations.json` by `scripts/research/build-derived-relations.ts`
 * for review, and the store loads them as origin `rule`. Neither grade is
 * counted (`COUNTED_GRADES`), so a proposal can never raise a dossier box or a
 * coverage ratio.
 *
 *   co-ownership   A owns V, V operates or owns facility F  →  A owns (an interest in) F, derived.
 *                  The share is the product of the two stakes only when both are stated
 *                  and the chain is the only one; otherwise no share is given.
 *   same-parent    Operators P owns, two at a time  →  O1 shares_parent_with O2, lead.
 *                  A country is not a parent here: the state holds too much to say anything.
 *   registry-bridge  A minted `company:` node whose name, without legal forms, is a name a
 *                  GLEIF or Wikidata record carries  →  may_be_same_as, lead. Never merged:
 *                  a merge is a reviewed line in config/entity-aliases.ts.
 *
 * Rules read counted relations only (stated, corroborated). They do not read
 * each other's output, and they never propose a relation the graph already has.
 */
import { matchKey } from '@/lib/graph/alias-match';
import { relationId } from '@/lib/graph/id';
import { graphNode, isCounted } from '@/lib/graph/index';
import type { GraphStore } from '@/lib/graph/store';
import type { EntityId } from '@/lib/entities/types';
import type { Relation, RelationEvidence, RelationType } from '@/lib/graph/types';

export const RULES = {
  'co-ownership':
    'A owns V and V operates or owns facility F, both stated: A holds an interest in F. Share = product of the two stated stakes, only for a single chain.',
  'same-parent':
    'Two operators with a stated owner in common (not a country) are related: a lead to check, not a fact.',
  'registry-bridge':
    'A minted company whose name without legal forms equals a name in a GLEIF or Wikidata record may be that entity: a lead for identity, never a merge.',
} as const;
export type RuleName = keyof typeof RULES;

const REGISTRY_HOST = /^https?:\/\/([a-z0-9-]+\.)*(gleif\.org|wikidata\.org)\//;

const kindOf = (id: string) => id.slice(0, id.indexOf(':'));
const earlier = (a: string, b: string) => (a < b ? a : b);

/** Every quote behind the chain, once each, in chain order. */
function evidenceOf(parents: readonly Relation[]): RelationEvidence[] {
  const out: RelationEvidence[] = [];
  for (const p of parents)
    for (const e of p.evidence)
      if (!out.some((x) => x.source === e.source && x.quote === e.quote)) out.push(e);
  return out;
}

interface Draft {
  from: EntityId;
  to: EntityId;
  type: RelationType;
  asOf: string;
  parents: Relation[];
  /** Per intermediate (the operator in the middle), the share its chain implies, or null. */
  shares: Map<string, number | null>;
}

/** The share, only when there is exactly one chain and it states both stakes. */
function onlyShare(d: Draft): number | null {
  return d.shares.size === 1 ? [...d.shares.values()][0] : null;
}

function finish(d: Draft, grade: 'derived' | 'lead', rule: RuleName): Relation {
  const parents = [...new Map(d.parents.map((p) => [p.id, p])).values()];
  const r: Relation = {
    id: '',
    from: d.from,
    to: d.to,
    type: d.type,
    grade,
    ...(onlyShare(d) !== null ? { share: { value: onlyShare(d)!, unit: 'percent' as const } } : {}),
    asOf: d.asOf,
    evidence: evidenceOf(parents),
    derivedFrom: parents.map((p) => p.id).sort(),
    rule,
    origin: 'rule',
  };
  r.id = relationId(r);
  return r;
}

function collect(
  drafts: Map<string, Draft>,
  d: Omit<Draft, 'shares'>,
  share: number | null,
  via: string,
) {
  const key = `${d.from}|${d.type}|${d.to}`;
  const seen = drafts.get(key) ?? drafts.set(key, { ...d, parents: [], shares: new Map() }).get(key)!;
  seen.parents.push(...d.parents);
  seen.asOf = earlier(seen.asOf, d.asOf);
  // One operator reached twice (it operates F and owns a stated share of it) is one chain.
  seen.shares.set(via, share ?? seen.shares.get(via) ?? null);
}

/** Drop drafts whose relation the graph already holds, in any grade. */
function fresh(out: Relation[], s: GraphStore): Relation[] {
  return out.filter((r) => !s.byId.has(r.id)).sort((a, b) => a.id.localeCompare(b.id));
}

/** Rule (a): an owner of an operator holds an interest in the operator's facility. */
export function coOwnership(s: GraphStore): Relation[] {
  const drafts = new Map<string, Draft>();
  for (const up of s.all) {
    if (up.type !== 'owns' || !isCounted(up)) continue;
    for (const down of s.from.get(up.to) ?? []) {
      if (!isCounted(down) || kindOf(down.to) !== 'facility') continue;
      if (down.type !== 'operates' && down.type !== 'owns') continue;
      if (up.from === down.to) continue;
      const share =
        down.type === 'owns' && up.share && down.share
          ? Math.round(up.share.value * down.share.value * 100) / 10000
          : null;
      collect(
        drafts,
        { from: up.from, to: down.to, type: 'owns', asOf: earlier(up.asOf, down.asOf), parents: [up, down] },
        share,
        up.to,
      );
    }
  }
  return fresh([...drafts.values()].map((d) => finish(d, 'derived', 'co-ownership')), s);
}

/** Rule (b): operators with a stated parent in common. */
export function sameParent(s: GraphStore): Relation[] {
  const isOperator = (id: string) => (s.from.get(id) ?? []).some((r) => r.type === 'operates' && isCounted(r));
  const drafts = new Map<string, Draft>();
  for (const [parent, edges] of s.from) {
    if (kindOf(parent) === 'country') continue;
    const held = edges.filter((r) => r.type === 'owns' && isCounted(r) && isOperator(r.to));
    const byChild = [...new Map(held.map((r) => [r.to, r])).values()].sort((a, b) => a.to.localeCompare(b.to));
    for (let i = 0; i < byChild.length; i++)
      for (let j = i + 1; j < byChild.length; j++) {
        const [a, b] = [byChild[i], byChild[j]];
        collect(
          drafts,
          { from: a.to, to: b.to, type: 'shares_parent_with', asOf: earlier(a.asOf, b.asOf), parents: [a, b] },
          null,
          parent,
        );
      }
  }
  return fresh([...drafts.values()].map((d) => finish({ ...d, shares: new Map() }, 'lead', 'same-parent')), s);
}

/** Rule (c): a minted name that a registry record also carries. */
export function registryBridge(s: GraphStore): Relation[] {
  const registered = new Map<string, { id: EntityId; via: Relation }>();
  for (const r of s.all) {
    if (!isCounted(r) || !r.evidence.some((e) => REGISTRY_HOST.test(e.source))) continue;
    for (const id of [r.from, r.to]) {
      const key = matchKey(graphNode(id, s).name);
      if (key && !registered.has(key)) registered.set(key, { id, via: r });
    }
  }
  const drafts = new Map<string, Draft>();
  const minted = new Set<string>();
  for (const r of s.all) for (const id of [r.from, r.to]) if (kindOf(id) === 'company') minted.add(id);
  for (const id of [...minted].sort()) {
    const node = graphNode(id, s);
    if (node.inDirectory) continue;
    const hit = registered.get(matchKey(node.name));
    if (!hit || hit.id === id) continue;
    const own = [...(s.from.get(id) ?? []), ...(s.to.get(id) ?? [])].find(isCounted);
    collect(
      drafts,
      { from: id as EntityId, to: hit.id, type: 'may_be_same_as', asOf: hit.via.asOf, parents: own ? [hit.via, own] : [hit.via] },
      null,
      hit.id,
    );
  }
  return fresh([...drafts.values()].map((d) => finish({ ...d, shares: new Map() }, 'lead', 'registry-bridge')), s);
}

/** Every proposal, sorted by id. */
export function proposeRelations(s: GraphStore): Relation[] {
  return [...coOwnership(s), ...sameParent(s), ...registryBridge(s)].sort((a, b) => a.id.localeCompare(b.id));
}
