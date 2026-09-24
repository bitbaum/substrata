import Link from 'next/link';

import { Figure } from '@/components/portal/Figure';
import { Status } from '@/components/portal/Status';
import { JUDGED_BY } from '@/config/substrata-about';
import { stageById } from '@/config/substrata-stages';
import { bottleneckBySlug, type Bottleneck } from '../../bottlenecks';
import { marketHref } from '../../links';
import type { Entity } from '../../entities/types';
import { t } from '../../i18n/messages';
import type { ProfileModule } from '../types';
import { Ticker } from '@/components/exposure/Ticker';
import { listingForName } from '@/lib/listings';

// What a bottleneck is, how it is judged and who makes it. What governs it and
// what would change it live in `bottleneck-levers.tsx`.

export function bottleneck(e: Entity): Bottleneck | undefined {
  return e.kind === 'bottleneck' ? bottleneckBySlug(e.key) : undefined;
}

const TESTS = [
  ['concentration', 'How few suppliers qualify'],
  ['substitution', 'How hard to replace'],
  ['leadTime', 'Decision to new capacity'],
  ['inelasticity', 'Can the buyer walk away'],
] as const;

const why: ProfileModule<Bottleneck> = {
  id: 'why',
  title: t('profile.why.title'),
  appliesTo: ['bottleneck'],
  importance: 10,
  load: bottleneck,
  Render({ data: b }) {
    const stage = stageById(b.stage);
    return (
      <>
        <p className="max-w-prose text-base leading-relaxed text-fg-secondary">{b.why}</p>
        {b.spec && (
          <p className="mt-3 max-w-prose text-sm text-fg-tertiary">
            <span className="font-mono text-xs uppercase tracking-caps">Grade that ships · </span>
            {b.spec}
          </p>
        )}
        <p className="mt-3 max-w-prose text-sm text-fg-tertiary">
          <span className="font-mono text-xs uppercase tracking-caps">Part of the process · </span>
          {stage.name}, which takes {stage.reliefTime.toLowerCase()} to loosen once somebody decides
          to.
        </p>
      </>
    );
  },
};

/** The four tests behind the score, so a judgement can be argued with rather than trusted. */
const severity: ProfileModule<Bottleneck> = {
  id: 'severity',
  title: t('profile.severity.title'),
  appliesTo: ['bottleneck'],
  importance: 20,
  load: bottleneck,
  evidence: (b) => `judged ${b.judgedOn} · a judgement, not a measurement`,
  Render({ data: b }) {
    return (
      <>
        <p className="mb-4 font-heading text-2xl font-semibold tabular-nums text-fg-primary">
          <Figure method="severity">{b.binding}</Figure>
          <span className="text-base font-normal text-fg-muted"> / 12</span>
        </p>
        <div className="grid gap-px overflow-hidden rounded-lg border border-subtle bg-border-subtle sm:grid-cols-4">
          {TESTS.map(([key, label]) => (
            <div key={key} className="bg-surface-raised px-4 py-3">
              <div className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                {label}
              </div>
              <div className="mt-1 font-heading text-2xl font-semibold tabular-nums text-fg-primary">
                <Figure estimate={{ by: JUDGED_BY, on: b.judgedOn, basis: b.rationale }}>
                  {b.score[key]}
                </Figure>
                <span className="text-sm font-normal text-fg-muted"> / 3</span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-fg-secondary">{b.rationale}</p>
      </>
    );
  },
};

const producers: ProfileModule<Bottleneck> = {
  id: 'producers',
  title: t('profile.producers.title'),
  appliesTo: ['bottleneck'],
  importance: 30,
  load: (e) => {
    const b = bottleneck(e);
    return b && b.producers.length > 0 ? b : null;
  },
  evidence: (b) =>
    `${b.counts.sourced} verified · ${b.counts.candidate} unchecked · ${b.counts.total} rows`,
  Render({ data: b }) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-strong">
              {['Organisation', 'Where', 'Step', 'Evidence'].map((column, i) => (
                <th
                  key={column}
                  scope="col"
                  className={`py-2.5 pr-4 font-mono text-xs font-medium uppercase tracking-caps text-fg-tertiary ${
                    i === 1 ? 'hidden sm:table-cell' : ''
                  }`}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {b.producers.map((p) => (
              <tr key={p.name} className="group align-top">
                <td className="py-3 pr-4">
                  <Link
                    href={marketHref(p.name)}
                    className="text-fg-primary underline-offset-4 group-hover:underline"
                  >
                    {p.name}
                  </Link>
                  <span className="mt-1 block text-xs">
                    <Ticker listing={listingForName(p.name)} compact />
                  </span>
                </td>
                <td className="hidden py-3 pr-4 font-mono text-xs tabular-nums text-fg-secondary sm:table-cell">
                  {p.jurisdictions.join(' ')}
                </td>
                <td className="py-3 pr-4 text-sm text-fg-secondary">{p.role}</td>
                <td className="py-3 text-sm">
                  {p.source ? (
                    <a
                      href={p.source}
                      className="inline-flex items-center gap-2 text-accent underline-offset-4 hover:underline"
                      rel="noreferrer"
                    >
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 rounded-full bg-status-positive"
                      />
                      Verified source ↗
                    </a>
                  ) : p.candidates.length > 0 ? (
                    <details>
                      <summary className="inline-flex cursor-pointer items-center gap-2 text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline">
                        <span
                          aria-hidden
                          className="inline-block h-1.5 w-1.5 rounded-full bg-status-warning"
                        />
                        {p.candidates.length} found, unchecked
                      </summary>
                      <ul className="mt-2 space-y-3">
                        {p.candidates.map((c) => (
                          <li key={c.url} className="max-w-prose">
                            <a
                              href={c.url}
                              rel="noreferrer"
                              className="text-accent underline-offset-4 hover:underline"
                            >
                              {c.title || c.url} ↗
                            </a>
                            <p className="mt-1 text-xs leading-relaxed text-fg-tertiary">
                              “{c.excerpt}”
                            </p>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <Status state="unverified" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  },
};

export { why, severity, producers };
