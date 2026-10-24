/**
 * The relation graph's read API. Everything outside `lib/graph` calls these;
 * nothing else reads the store's maps.
 *
 * Design: docs/architecture/2026-10-24-research-systems.md §2–3.
 * How to add an edge: lib/graph/README.md.
 */
import { graphNode, graphStore, type GraphNode, type GraphStore } from './store';
import type { EvidenceGrade, Relation, RelationOrigin, RelationType } from './types';
import { atLeast, countedShare, isCounted } from './validate';

export type { GraphNode } from './store';
export { graphNode, graphStore } from './store';
export { atLeast, countedShare, isCounted, relationId } from './validate';
export * from './types';

export interface RelationFilter {
  type?: RelationType | readonly RelationType[];
  /** Only relations at least this strong: `stated` keeps stated and corroborated. */
  minGrade?: EvidenceGrade;
  /** Only these origins; leave out `candidate` for reviewed rows only. */
  origin?: readonly RelationOrigin[];
}

function keep(r: Relation, f: RelationFilter): boolean {
  if (f.type && !(Array.isArray(f.type) ? f.type : [f.type]).includes(r.type)) return false;
  if (f.minGrade && !atLeast(r.grade, f.minGrade)) return false;
  if (f.origin && !f.origin.includes(r.origin ?? 'curated')) return false;
  return true;
}

/** Every relation, in id order. */
export function allRelations(s: GraphStore = graphStore()): readonly Relation[] {
  return s.all;
}

export function relationById(id: string, s: GraphStore = graphStore()): Relation | undefined {
  return s.byId.get(id);
}

/**
 * Rule proposals touching `id` (lib/coverage/rules.ts): `derived` and `lead`
 * relations with their chain, kept out of every walk and count above until a
 * person promotes one. A page may show them, labelled, beside the stated rows.
 */
export function proposalsFor(id: string, s: GraphStore = graphStore()): Relation[] {
  return s.proposals.filter((r) => r.from === id || r.to === id);
}

/** Relations leaving `id`: what it operates, owns, supplies. */
export function relationsFrom(id: string, f: RelationFilter = {}, s = graphStore()): Relation[] {
  return (s.from.get(id) ?? []).filter((r) => keep(r, f));
}

/** Relations arriving at `id`: who operates it, owns it, supplies it. */
export function relationsTo(id: string, f: RelationFilter = {}, s = graphStore()): Relation[] {
  return (s.to.get(id) ?? []).filter((r) => keep(r, f));
}

export interface Neighbour {
  node: GraphNode;
  relation: Relation;
  /** `out`: this entity → the neighbour; `in`: the neighbour → this entity. */
  direction: 'out' | 'in';
}

/** Every entity one relation away, either direction. */
export function neighbours(id: string, f: RelationFilter = {}, s = graphStore()): Neighbour[] {
  return [
    ...relationsFrom(id, f, s).map((relation) => ({
      node: graphNode(relation.to, s),
      relation,
      direction: 'out' as const,
    })),
    ...relationsTo(id, f, s).map((relation) => ({
      node: graphNode(relation.from, s),
      relation,
      direction: 'in' as const,
    })),
  ];
}

/**
 * Simple paths from `a` to `b`, shortest first, walking relations in either
 * direction (an owner and an operator of one facility are two hops apart:
 * owner → operator → facility). Each path is its relations in order.
 */
export function pathsBetween(
  a: string,
  b: string,
  opts: RelationFilter & { maxHops?: number; limit?: number } = {},
  s: GraphStore = graphStore(),
): Relation[][] {
  const maxHops = opts.maxHops ?? 3;
  const limit = opts.limit ?? 20;
  if (a === b) return [];
  const found: Relation[][] = [];
  // Breadth first, so paths come out shortest first; a path never revisits a node.
  let frontier: { at: string; path: Relation[]; seen: Set<string> }[] = [
    { at: a, path: [], seen: new Set([a]) },
  ];
  for (let hop = 0; hop < maxHops && frontier.length && found.length < limit; hop++) {
    const next: typeof frontier = [];
    for (const { at, path, seen } of frontier) {
      for (const { relation, node } of neighbours(at, opts, s)) {
        if (seen.has(node.id)) continue;
        const walked = [...path, relation];
        if (node.id === b) {
          found.push(walked);
          if (found.length >= limit) return found;
        } else next.push({ at: node.id, path: walked, seen: new Set([...seen, node.id]) });
      }
    }
    frontier = next;
  }
  return found;
}

const VERB: Record<RelationType, string> = {
  operates: 'operates',
  owns: 'owns',
  finances: 'finances',
  supplies: 'supplies',
  buys_from: 'buys from',
  ships_to: 'ships to',
  licenses: 'licenses',
  regulates: 'regulates',
  researches: 'researches',
  employs: 'employs',
  competes_with: 'competes with',
  shares_parent_with: 'shares a stated parent with',
  may_be_same_as: 'may be the same organisation as',
};

export const GRADE_LABEL: Record<EvidenceGrade, string> = {
  stated: 'Stated by a source',
  corroborated: 'Stated by two independent sources',
  derived: 'Worked out from other relations',
  lead: 'Unverified lead — not counted',
};

const READING_LABEL = {
  verbatim: 'quoted from the source',
  'table-cell': 'the table cell, copied whole',
  'curated-record': 'the corpus row as a person read it from the source — not a verbatim quote',
} as const;

export interface PrintedEvidence {
  relationId: string;
  /** "NAC Kazatomprom JSC owns 60% of JV Inkai LLP". */
  sentence: string;
  grade: EvidenceGrade;
  gradeLabel: string;
  /** Whether a number may use it. */
  counted: boolean;
  /** The share, only when counted; null for a lead or an edge without one. */
  share: number | null;
  asOf: string;
  origin: RelationOrigin;
  candidate: boolean;
  sources: {
    url: string;
    quote: string;
    readOn: string;
    locator?: string;
    reading: string;
  }[];
  /** For a derived relation or a rule-made lead: the rule, and the evidence of each relation it follows from. */
  rule?: string;
  chain?: PrintedEvidence[];
}

/** What a page prints for one relation: the claim, the grade, and every source behind it. */
export function relationEvidence(r: Relation, s: GraphStore = graphStore()): PrintedEvidence {
  const from = graphNode(r.from, s).name;
  const to = graphNode(r.to, s).name;
  const share = r.share ? ` ${r.share.value}% of` : '';
  const volume = r.volume
    ? ` (${r.volume.value} ${r.volume.unit}${r.volume.commodity ? ` of ${r.volume.commodity}` : ''}, ${r.volume.period})`
    : '';
  const origin = r.origin ?? 'curated';
  return {
    relationId: r.id,
    sentence: `${from} ${VERB[r.type]}${share} ${to}${volume}`,
    grade: r.grade,
    gradeLabel: GRADE_LABEL[r.grade],
    counted: isCounted(r),
    share: countedShare(r),
    asOf: r.asOf,
    origin,
    candidate: origin === 'candidate',
    sources: r.evidence.map((e) => ({
      url: e.source,
      quote: e.quote,
      readOn: e.readOn,
      ...(e.locator ? { locator: e.locator } : {}),
      reading: READING_LABEL[e.reading ?? 'verbatim'],
    })),
    ...(r.derivedFrom?.length
      ? {
          rule: r.rule,
          chain: (r.derivedFrom ?? []).flatMap((id) => {
            const parent = s.byId.get(id);
            return parent ? [relationEvidence(parent, s)] : [];
          }),
        }
      : {}),
  };
}

/** Counts for a status line, and what the producers could not turn into edges. */
export function graphStats(s: GraphStore = graphStore()) {
  const tally = (key: (r: Relation) => string) => {
    const out: Record<string, number> = {};
    for (const r of s.all) out[key(r)] = (out[key(r)] ?? 0) + 1;
    return out;
  };
  return {
    relations: s.all.length,
    byType: tally((r) => r.type),
    byGrade: tally((r) => r.grade),
    byOrigin: tally((r) => r.origin ?? 'curated'),
    proposals: s.proposals.length,
    conflicts: s.conflicts,
    corpusSkipped: s.skipped,
    usgs: {
      rows: s.usgs.rows,
      rowsWithEdges: s.usgs.rowsWithEdges,
      rowsUnparsed: s.usgs.rowsUnparsed,
    },
  };
}
