import Link from 'next/link';

import { SCIENCE } from '@/config/substrata-science';
import { resolveIn } from '../../entities/registry';
import type { Entity } from '../../entities/types';
import { t, type MessageKey } from '../../i18n/messages';
import { pipelineHref } from '../../links';
import { RELATION_LABEL, type RelationKind } from '../../relations/types';
import { resolvedConnectionsOf, type ResolvedConnection } from '../../relations/registry';
import type { ProfileModule } from '../types';

/**
 * A relation read from the bottleneck's end. `inverse` is the direction: a
 * bottleneck is the `to` of `produces` (its makers) but the `from` of
 * `governed-by` (its rules), and the label alone is how a reader tells them apart.
 */
interface Reading {
  kind: RelationKind;
  inverse: boolean;
}

interface Group {
  id: string;
  heading: MessageKey;
  readings: Reading[];
  /**
   * What to say when the corpus has nothing. Set for the questions every
   * science page has to answer — who is affected, what it is for, what else is
   * being tried, what rules and what money — so a gap reads as a gap to fill
   * rather than as a section that does not exist. Unset groups only show when
   * they have rows.
   */
  empty?: MessageKey;
}

/** The order is the reading order: who is affected first, then the levers. */
export const AROUND_GROUPS: Group[] = [
  {
    id: 'companies',
    heading: 'profile.around.companies',
    readings: [{ kind: 'produces', inverse: true }],
    empty: 'profile.around.companies.empty',
  },
  {
    id: 'markets',
    heading: 'profile.around.markets',
    readings: [{ kind: 'depends-on', inverse: true }],
    empty: 'profile.around.markets.empty',
  },
  {
    id: 'science',
    heading: 'profile.around.science',
    readings: [{ kind: 'relieved-by', inverse: false }],
    empty: 'profile.around.science.empty',
  },
  {
    id: 'policy',
    heading: 'profile.around.policy',
    readings: [{ kind: 'governed-by', inverse: false }],
    empty: 'profile.around.policy.empty',
  },
  {
    id: 'capital',
    heading: 'profile.around.capital',
    readings: [{ kind: 'fundable-by', inverse: false }],
    empty: 'profile.around.capital.empty',
  },
  {
    id: 'places',
    heading: 'profile.around.places',
    readings: [
      { kind: 'supplies', inverse: true },
      { kind: 'endowed-with', inverse: true },
    ],
  },
  {
    id: 'loops',
    heading: 'profile.around.loops',
    readings: [{ kind: 'gates', inverse: false }],
  },
];

export interface AroundGroup {
  id: string;
  heading: MessageKey;
  empty?: MessageKey;
  rows: ResolvedConnection[];
}

export interface AroundBottleneck {
  bottleneck: Entity;
  groups: AroundGroup[];
}

function reads(connection: ResolvedConnection, reading: Reading): boolean {
  const label = RELATION_LABEL[reading.kind];
  return (
    connection.kind === reading.kind &&
    connection.label === (reading.inverse ? label.inverse : label.forward)
  );
}

/**
 * For each bottleneck a science entry would relieve, what that bottleneck is
 * joined to — read from the same relation registry as every other profile, so
 * the science page cannot disagree with the bottleneck page about who makes it.
 */
export function aroundFor(entity: Entity): AroundBottleneck[] {
  if (entity.kind !== 'science') return [];
  const entry = SCIENCE.find((s) => s.id === entity.key);
  if (!entry) return [];
  return entry.relieves.flatMap(({ bottleneck: name }) => {
    const bottleneck = resolveIn('bottleneck', name);
    if (!bottleneck) return [];
    const connections = resolvedConnectionsOf(bottleneck.id).filter(
      // The page being read is not "other science" on its own bottleneck.
      (c) => c.entity.id !== entity.id,
    );
    const groups = AROUND_GROUPS.map((group) => ({
      id: group.id,
      heading: group.heading,
      ...(group.empty ? { empty: group.empty } : {}),
      rows: connections.filter((c) => group.readings.some((r) => reads(c, r))),
    })).filter((group) => group.rows.length > 0 || group.empty);
    return [{ bottleneck, groups }];
  });
}

function GroupRows({ rows }: { rows: ResolvedConnection[] }) {
  // One evidence line when the whole group shares it; otherwise each row says
  // its own, so an unverified lead never reads like a sourced finding.
  const shared = rows.every((row) => row.evidence === rows[0].evidence) ? rows[0].evidence : null;
  return (
    <>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {rows.map((row) => (
          <li key={`${row.kind}:${row.entity.id}`}>
            <Link
              href={row.entity.href}
              className="text-fg-primary underline-offset-4 hover:underline"
            >
              {row.entity.name}
            </Link>
            {!shared && <span className="ml-1 text-xs text-fg-tertiary">· {row.evidence}</span>}
          </li>
        ))}
      </ul>
      {shared && <p className="mt-1 text-xs text-fg-tertiary">{shared}</p>}
    </>
  );
}

/**
 * Who and what sits around the bottleneck this science would relieve: the
 * firms it would affect, what depends on it, what else is being tried, the
 * rules and the money — and where the research itself is happening.
 */
const around: ProfileModule<AroundBottleneck[]> = {
  id: 'around',
  title: t('profile.around.title'),
  appliesTo: ['science'],
  importance: 35,
  load: (entity) => {
    const found = aroundFor(entity);
    return found.length > 0 ? found : null;
  },
  evidence: () => t('evidence.joinsCarryOwn'),
  Render({ data }) {
    return (
      <div className="divide-y divide-subtle border-y border-subtle">
        {data.map(({ bottleneck, groups }) => (
          <div key={bottleneck.id} className="py-5">
            {data.length > 1 && (
              <h3 className="mb-4 font-medium text-fg-primary">
                <Link href={bottleneck.href} className="underline-offset-4 hover:underline">
                  {bottleneck.name}
                </Link>
              </h3>
            )}
            <dl className="grid gap-4">
              {groups.map((group) => (
                <div key={group.id}>
                  <dt className="mb-1 font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                    {t(group.heading)}
                  </dt>
                  <dd className="text-sm leading-relaxed text-fg-secondary">
                    {group.rows.length > 0 ? (
                      <GroupRows rows={group.rows} />
                    ) : (
                      group.empty && <span className="text-fg-tertiary">{t(group.empty)}</span>
                    )}
                  </dd>
                </div>
              ))}
              <div>
                <dt className="mb-1 font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                  {t('profile.around.research')}
                </dt>
                <dd className="text-sm">
                  <Link
                    href={pipelineHref(bottleneck.name)}
                    className="text-accent underline-offset-4 hover:underline"
                  >
                    {t('profile.around.research.link')}
                  </Link>
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    );
  },
};

export { around };
