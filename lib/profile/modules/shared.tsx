import Link from 'next/link';

import { PageDiscussion } from '@/components/portal/PageDiscussion';
import { GRAPH_KINDS, neighbors, type GraphKind } from '../../graph';
import type { Entity } from '../../entities/types';
import { t } from '../../i18n/messages';
import type { ProfileModule } from '../types';
import { DEPENDENCY_LABELS } from './dependencies';

/**
 * Relations that already have a section of their own, per kind.
 *
 * A bottleneck lists its makers under "Who makes it" and its funders under "Who
 * could fund relief"; repeating both as "produced by" and "fundable by" made
 * this module a second copy of two sections directly above it. Connections is
 * for what nothing else on the profile says.
 */
const ALREADY_A_SECTION: Record<string, string[]> = {
  // A bottleneck's loops are shown by "What this holds up"; a loop's gates by
  // "What is in the way". Neither should be listed twice.
  // Dependency rows have their own section with the quoted sentence.
  bottleneck: ['produced by', 'fundable by', 'gates', ...DEPENDENCY_LABELS],
  loop: ['gated by'],
  company: ['makes', ...DEPENDENCY_LABELS],
  capital: ['fundable by'],
};

/**
 * The corpus joins for an entity, minus anything its own profile already shows.
 *
 * Exported so the rule is testable: "connections must not repeat a section".
 */
export function connectionsFor(entity: Entity) {
  if (!(GRAPH_KINDS as string[]).includes(entity.kind)) return [];
  const covered = ALREADY_A_SECTION[entity.kind] ?? [];
  return neighbors(entity.kind as GraphKind, entity.key)
    .filter((edge) => !covered.includes(edge.rel))
    .slice(0, 12);
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
  title: t('profile.related.title'),
  appliesTo: ['country', 'company', 'bottleneck', 'science', 'capital', 'loop'],
  importance: 88,
  load: (entity: Entity) => {
    const edges = connectionsFor(entity);
    return edges.length > 0 ? edges : null;
  },
  evidence() {
    return 'each join carries its own evidence';
  },
  Render({ data }) {
    return (
      <ul className="divide-y divide-subtle border-y border-subtle">
        {data.map((edge) => (
          <li key={`${edge.rel}:${edge.to.href}`} className="py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <Link
                href={edge.to.href}
                className="text-fg-primary underline-offset-4 hover:underline"
              >
                {edge.to.label}
              </Link>
              <span className="font-mono text-xs uppercase tracking-caps text-fg-muted">
                {edge.rel}
              </span>
            </div>
            {/* How well the JOIN is evidenced, which is not the same as how well
                either end is. A sourced company and a sourced material can still
                be connected by nothing but a directory guess. */}
            <p className="mt-1 text-xs text-fg-tertiary">{edge.evidence}</p>
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
  title: t('profile.discussion.title'),
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
