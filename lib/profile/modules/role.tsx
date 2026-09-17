import Link from 'next/link';

import { rolesOf, type Role } from '../../kpi/loops';
import { t } from '../../i18n/messages';
import type { Entity } from '../../entities/types';
import type { ProfileModule } from '../types';

/**
 * What this holds up.
 *
 * The site's subject is the rate at which technology improves, and its model is
 * loops: design → build → measure, turned as fast as the slowest thing in the
 * way allows. So the question worth asking of any entity is not "is it
 * important" but "which loop does it hold up, and through what".
 *
 * This replaces the bottleneck-only "Which loops wait on it" section: the
 * traversal is the same for a company, a rule, a mandate or a country — they
 * reach the loops through the bottlenecks they are joined to — so it is one
 * module rather than one per kind.
 *
 * The strength of "this firm holds up that loop" is the strength of its weakest
 * join, which is why each row shows how that join is evidenced.
 */
const role: ProfileModule<{ roles: Role[]; direct: boolean }> = {
  id: 'role',
  title: t('profile.role.title'),
  appliesTo: ['bottleneck', 'company', 'science', 'capital', 'country'],
  importance: 84,
  load(entity: Entity) {
    const roles = rolesOf(entity.id);
    return roles.length > 0 ? { roles, direct: entity.kind === 'bottleneck' } : null;
  },
  evidence: ({ roles }) => `${roles.length} ${roles.length === 1 ? 'loop' : 'loops'}`,
  Render({ data: { roles, direct } }) {
    return (
      <>
        <ul className="divide-y divide-subtle border-y border-subtle">
          {roles.map((entry) => (
            <li key={`${entry.loop.id}:${entry.through.id}`} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <Link
                  href="/research"
                  className="font-medium text-fg-primary underline-offset-4 hover:underline"
                >
                  {entry.loop.name}
                </Link>
                <span className="font-mono text-xs text-fg-secondary">
                  one turn: {entry.loop.period}
                </span>
              </div>
              {!direct && (
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-secondary">
                  {entry.via}{' '}
                  <Link
                    href={entry.through.href}
                    className="text-fg-primary underline-offset-4 hover:underline"
                  >
                    {entry.through.name}
                  </Link>
                  , which gates it.
                </p>
              )}
              <p className="mt-1 text-xs text-fg-tertiary">
                Worst judgement on this loop: {entry.loop.worstBinding} of 12
                {entry.loop.judgedOn ? `, judged ${entry.loop.judgedOn}` : ''}
                {direct ? '' : ` · this join is ${entry.evidence}`}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-3 max-w-prose text-xs leading-relaxed text-fg-muted">
          A loop is one design, build and measure turn. Severity is a dated judgement on a 0–12
          scale, not a measurement, and the judgements are not added together — the figure shown is
          the worst single one.
        </p>
      </>
    );
  },
};

export { role };
