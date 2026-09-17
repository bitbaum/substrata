import Link from 'next/link';

import { PageDiscussion } from '@/components/portal/PageDiscussion';
import { neighbors, type GraphKind } from '../../graph';
import { resolveIn } from '../../entities/registry';
import { WORLD_PATHS } from '@/config/world-paths';
import type { Entity } from '../../entities/types';
import { defineModule, type AnyProfileModule } from '../define';
import type { ProfileModule } from '../types';

const GRAPH_KINDS = new Set<string>(['country', 'company', 'bottleneck', 'science', 'capital']);

/** The best name we have for a graph node: the registry first, then the map. */
function label(kind: GraphKind, id: string): string | undefined {
  const entity = resolveIn(kind, id);
  if (entity) return entity.name;
  if (kind === 'country') return WORLD_PATHS.find((p) => p.iso2 === id.toLowerCase())?.name;
  return undefined;
}

/**
 * What the corpus already connects this entity to.
 *
 * The graph existed and was reachable only through `/api/graph` and the country
 * dossier, so a company page could not tell you what it sits next to. Reading
 * it here means every kind the graph covers gains the same section at once.
 */
const related: ProfileModule<ReturnType<typeof neighbors>> = {
  id: 'related',
  title: 'What this connects to',
  appliesTo: ['country', 'company', 'bottleneck', 'science', 'capital'],
  importance: 40,
  load(entity: Entity) {
    if (!GRAPH_KINDS.has(entity.kind)) return null;
    const edges = neighbors(entity.kind as GraphKind, entity.key);
    return edges.length > 0 ? edges.slice(0, 12) : null;
  },
  evidence() {
    return 'joins drawn from the corpus, not independent findings';
  },
  Render({ data }) {
    return (
      <ul className="divide-y divide-subtle border-y border-subtle">
        {data.map((edge) => (
          <li
            key={`${edge.rel}:${edge.to.href}`}
            className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3"
          >
            <Link
              href={edge.to.href}
              className="text-fg-primary underline-offset-4 hover:underline"
            >
              {/* The graph labels a country with its ISO code. Prefer the registry,
                  then the map's own name: only countries with a resources row are
                  entities, so a reader would otherwise just see "KR". */}
              {label(edge.to.kind, edge.to.id) ?? edge.to.label}
            </Link>
            <span className="font-mono text-xs uppercase tracking-caps text-fg-muted">
              {edge.rel}
            </span>
          </li>
        ))}
      </ul>
    );
  },
};

/**
 * Discussion, on everything.
 *
 * A claim gets tested by being argued with, so every entity carries a thread —
 * not just the three page types that happened to mount one by hand. Reading is
 * public; writing needs an account, and the assistant posts as an `ai`
 * participant rather than as a person.
 */
const discussion: ProfileModule<{ path: string }> = {
  id: 'discussion',
  title: 'Discussion',
  appliesTo: '*',
  importance: 90,
  ownsHeading: true,
  load(entity: Entity) {
    // Threads are keyed by path, so an entity whose href carries a query string
    // would split its own discussion across filter states.
    const path = entity.href.split('?')[0];
    return path.startsWith('/') ? { path } : null;
  },
  Render({ data }) {
    return <PageDiscussion path={data.path} />;
  },
};

export { related, discussion };
