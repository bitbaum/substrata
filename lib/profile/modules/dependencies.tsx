import Link from 'next/link';

import { hostOf } from '../../desk';
import { GRAPH_KINDS, neighbors, type GraphEdge, type GraphKind } from '../../graph';
import { RELATION_LABEL } from '../../relations/types';
import { t } from '../../i18n/messages';
import type { Entity } from '../../entities/types';
import type { ProfileModule } from '../types';
import { CAPS, LINK, NAME } from './company';

/**
 * What this rests on, and what rests on it — the dependency rows, read from
 * either end, each with the sentence that carries it.
 *
 * The rows lived only in `/xray` and `/scenarios`; a company page could not say
 * that NVIDIA's filing names CoWoS, and the CoWoS page could not say who named
 * it. They are graph edges now, so this module reads them like any other join.
 */

/** Labels this module owns, in the order the groups are shown. */
export const DEPENDENCY_LABELS: readonly string[] = [
  RELATION_LABEL['depends-on'].forward,
  RELATION_LABEL['depends-on'].inverse,
  RELATION_LABEL['sells-into'].forward,
  RELATION_LABEL['sells-into'].inverse,
];

const HEADING: Record<string, string> = {
  [RELATION_LABEL['depends-on'].forward]: 'Depends on',
  [RELATION_LABEL['depends-on'].inverse]: 'Depended on by',
  [RELATION_LABEL['sells-into'].forward]: 'Sells into',
  [RELATION_LABEL['sells-into'].inverse]: 'Sold into by',
};

type Group = { label: string; edges: GraphEdge[] };

export function dependencyGroups(entity: Entity): Group[] {
  if (!(GRAPH_KINDS as string[]).includes(entity.kind)) return [];
  const edges = neighbors(entity.kind as GraphKind, entity.key);
  return DEPENDENCY_LABELS.map((label) => ({
    label,
    edges: edges.filter((e) => e.rel === label),
  })).filter((g) => g.edges.length > 0);
}

export const dependencies: ProfileModule<Group[]> = {
  id: 'dependencies',
  title: t('profile.dependencies.title'),
  appliesTo: ['company', 'bottleneck'],
  importance: 36,
  load(entity) {
    const groups = dependencyGroups(entity);
    return groups.length > 0 ? groups : null;
  },
  evidence: () => 'each row quotes the page it rests on',
  Render({ data }) {
    return (
      <div className="space-y-6">
        {data.map((group) => (
          <section key={group.label}>
            <h3 className={CAPS}>{HEADING[group.label] ?? group.label}</h3>
            <ul className="mt-2 divide-y divide-subtle border-y border-subtle">
              {group.edges.map((edge) => (
                <li key={`${edge.to.href}:${edge.sources[0]}`} className="py-3">
                  <Link href={edge.to.href} className={NAME}>
                    {edge.to.label}
                  </Link>
                  {edge.quote && (
                    <blockquote className="mt-1 border-l-2 border-subtle pl-3 text-sm leading-relaxed text-fg-secondary">
                      “{edge.quote}”
                    </blockquote>
                  )}
                  <p className="mt-1 text-xs text-fg-tertiary">
                    {edge.sources[0] && (
                      <a href={edge.sources[0]} rel="noreferrer" className={LINK}>
                        {hostOf(edge.sources[0])}
                      </a>
                    )}
                    {' · '}
                    {edge.evidence}
                    {edge.scope ? ` · ${edge.scope}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="text-xs text-fg-tertiary">
          A recorded dependency is a sentence, not a share, a volume or a contract.{' '}
          <Link href="/xray" className={LINK}>
            Walk it on a portfolio →
          </Link>
        </p>
      </div>
    );
  },
};
