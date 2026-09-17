import Link from 'next/link';

import { SeverityBar } from '@/components/portal/Status';
import { loops, type Loop } from '../../kpi/loops';
import { t } from '../../i18n/messages';
import type { Entity } from '../../entities/types';
import type { ProfileModule } from '../types';

function loopOf(entity: Entity): Loop | undefined {
  return entity.kind === 'loop' ? loops().find((l) => l.id === entity.key) : undefined;
}

/**
 * What is in the way of this loop turning faster.
 *
 * The mirror of "What this holds up": read from the loop's end, the same
 * relations answer what is stopping it. Worst first, because the slowest gate
 * is the one that sets the pace — relieving any other changes nothing until it
 * moves.
 */
const gates: ProfileModule<Loop> = {
  id: 'gates',
  title: t('profile.gates.title'),
  appliesTo: ['loop'],
  importance: 10,
  load: (entity) => {
    const loop = loopOf(entity);
    return loop && loop.gates.length > 0 ? loop : null;
  },
  evidence: (loop) => `${loop.gates.length} recorded · worst judged ${loop.worstBinding} of 12`,
  Render({ data }) {
    return (
      <>
        <ul className="divide-y divide-subtle border-y border-subtle">
          {data.gates.map((gate) => (
            <li key={gate.entity.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <Link
                  href={gate.entity.href}
                  className="font-medium text-fg-primary underline-offset-4 hover:underline"
                >
                  {gate.entity.name}
                </Link>
                <SeverityBar value={gate.binding} />
              </div>
              <p className="mt-1 text-xs text-fg-tertiary">
                {gate.horizon === 'now' ? 'Judged to bite now' : 'Judged to bite later'} · judged{' '}
                {gate.judgedOn} · {gate.state}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-3 max-w-prose text-xs leading-relaxed text-fg-muted">
          The slowest gate sets the pace: relieving any other one changes nothing until it moves.
          Severity is a dated judgement on a 0–12 scale, not a measurement, and these are not added
          together.
        </p>
      </>
    );
  },
};

/** How fast this loop turns, which is the quantity the whole site is about. */
const turn: ProfileModule<Loop> = {
  id: 'turn',
  title: t('profile.turn.title'),
  appliesTo: ['loop'],
  importance: 5,
  load: loopOf,
  Render({ data }) {
    return (
      <div className="rounded-lg border border-subtle bg-surface-raised px-5 py-4">
        <p className="font-heading text-2xl font-semibold text-fg-primary">{data.period}</p>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-fg-secondary">{data.turn}</p>
        <p className="mt-3 text-xs text-fg-tertiary">
          Part of {data.programme}. A faster loop compounds: one that turns in a day improves
          hundreds of times more often than one that turns in a year.
        </p>
      </div>
    );
  },
};

export { turn, gates };
