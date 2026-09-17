import Link from 'next/link';

import { SeverityBar } from '@/components/portal/Status';
import { SCIENCE, readinessLabel } from '@/config/substrata-science';
import { bottleneckByName } from '../../bottlenecks';
import { bottleneckHref } from '../../links';
import type { Entity } from '../../entities/types';
import { t } from '../../i18n/messages';
import type { ProfileModule } from '../types';

type ScienceEntry = (typeof SCIENCE)[number];

function entry(e: Entity): ScienceEntry | undefined {
  return e.kind === 'science' ? SCIENCE.find((s) => s.id === e.key) : undefined;
}

/** What relieving this would unblock, and by what mechanism. */
const relieves: ProfileModule<ScienceEntry> = {
  id: 'relieves',
  title: t('profile.relieves.title'),
  appliesTo: ['science'],
  importance: 10,
  load: (e) => {
    const found = entry(e);
    return found && found.relieves.length > 0 ? found : null;
  },
  Render({ data }) {
    return (
      <ul className="divide-y divide-subtle border-y border-subtle">
        {data.relieves.map((relief) => {
          const bottleneck = bottleneckByName(relief.bottleneck);
          return (
            <li key={relief.bottleneck} className="py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <Link
                  href={bottleneckHref(relief.bottleneck)}
                  className="font-medium text-fg-primary underline-offset-4 hover:underline"
                >
                  {relief.bottleneck}
                </Link>
                {bottleneck && <SeverityBar value={bottleneck.binding} />}
              </div>
              <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-secondary">
                {relief.mechanism}
              </p>
            </li>
          );
        })}
      </ul>
    );
  },
};

/** Readiness, with the reasoning and whether anything backs it. */
const readiness: ProfileModule<ScienceEntry> = {
  id: 'readiness',
  title: t('profile.readiness.title'),
  appliesTo: ['science'],
  importance: 20,
  load: entry,
  evidence: (s) => `judged ${s.judgedOn}`,
  Render({ data }) {
    return (
      <div className="rounded-lg border border-subtle bg-surface-raised px-5 py-4">
        <p className="font-heading text-2xl font-semibold text-fg-primary">
          {data.readiness}
          <span className="text-base font-normal text-fg-muted"> / 9</span>
          <span className="ml-3 font-sans text-base font-normal text-fg-secondary">
            {readinessLabel(data.readiness)}
          </span>
        </p>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-fg-secondary">
          {data.readinessWhy}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-fg-tertiary">
          {data.source ? (
            <a
              href={data.source}
              rel="noreferrer"
              className="text-accent underline-offset-4 hover:underline"
            >
              Source ↗
            </a>
          ) : (
            'Unsourced: this is a judgement, and no citation has been attached to it yet.'
          )}
        </p>
      </div>
    );
  },
};

/** The next observable thing, which is what makes the judgement falsifiable. */
const milestone: ProfileModule<string> = {
  id: 'milestone',
  title: t('profile.milestone.title'),
  appliesTo: ['science'],
  importance: 30,
  load: (e) => entry(e)?.nextMilestone ?? null,
  Render({ data }) {
    return (
      <p className="max-w-prose border-y border-subtle py-4 text-base leading-relaxed text-fg-secondary">
        {data}
      </p>
    );
  },
};

export { relieves, readiness, milestone };
