/**
 * The derived graph, as the app has always consumed it.
 *
 * The joins themselves now live in `lib/relations`, declared once with an
 * inverse and an evidence state each. This module is the adapter that keeps the
 * existing shape — `/api/graph`, the country dossier, chat retrieval and the
 * profile module all read it — and it inherits three fixes by construction:
 * a policy instrument is a policy node rather than a capital one, `makes` and
 * `produced by` cannot disagree because they are one declaration, and every
 * edge says how well the join itself is evidenced.
 */
import { entityId, type EntityKind } from './entities/types';
import { resolveEntity } from './entities/registry';
import { connectionsOf } from './relations/registry';

export type GraphKind = Extract<
  EntityKind,
  'country' | 'company' | 'bottleneck' | 'science' | 'capital' | 'policy' | 'loop'
>;

export type GraphNode = {
  kind: GraphKind;
  id: string;
  label: string;
  href: string;
};

export type GraphEdge = {
  from: GraphNode;
  to: GraphNode;
  rel: string;
  /** How well this join is stood up — not how well either end is. */
  evidence: string;
  sources: string[];
  /** The sentence in `sources[0]` that carries the join, verbatim, when it has one. */
  quote?: string;
  scope?: string;
};

export const GRAPH_KINDS: GraphKind[] = [
  'country',
  'company',
  'bottleneck',
  'science',
  'capital',
  'policy',
  'loop',
];

export function neighbors(kind: GraphKind, id: string): GraphEdge[] {
  const self = resolveEntity(entityId(kind, id.toLowerCase()));
  if (!self) return [];
  const from: GraphNode = { kind, id: self.key, label: self.name, href: self.href };

  return connectionsOf(self.id).flatMap((connection) => {
    const other = resolveEntity(connection.other);
    if (!other) return [];
    return [
      {
        from,
        to: {
          kind: other.kind as GraphKind,
          id: other.key,
          // Labels come from the registry, so a country is its name rather than
          // the ISO code the old graph printed.
          label: other.name,
          href: other.href,
        },
        rel: connection.label,
        evidence: connection.evidence,
        sources: connection.sources,
        ...(connection.quote ? { quote: connection.quote } : {}),
        ...(connection.scope ? { scope: connection.scope } : {}),
      },
    ];
  });
}
