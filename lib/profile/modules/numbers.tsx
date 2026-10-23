import Link from 'next/link';

import { LineChart, Sparkline } from '@bitbaum/chartkit/react';
import { Figure } from '@/components/portal/Figure';
import type { Entity } from '../../entities/types';
import { bottleneckBySlug } from '../../bottlenecks';
import { bottleneckHref, seriesHref } from '../../links';
import { participantBySlug } from '../../participants';
import {
  KIND_LABEL,
  corpusSeries,
  formatPoint,
  lastActual,
  periodLabel,
  type Series,
} from '../../series';
import { t } from '../../i18n/messages';
import type { ProfileModule } from '../types';
import { CAPS, LINK } from './company';

interface Numbers {
  name: string;
  /** The series whose geography is this company, headline first, most-pointed next. */
  series: Series[];
}

/** How many series are drawn in full; the rest are rows with a sparkline. */
const CHARTED = 3;

/**
 * The series filed under this company: `geography: "company: GE Vernova"`,
 * or a segment of it ("company: GE Vernova (Electrification)"). Matched on
 * the name the directory uses, so a series on a division joins its company.
 */
export function companySeries(name: string): Series[] {
  const wanted = `company: ${name}`.toLowerCase();
  return corpusSeries()
    .filter((s) => {
      const g = s.geography.toLowerCase();
      return g === wanted || g.startsWith(`${wanted} (`) || g.startsWith(`${wanted} —`);
    })
    .sort(
      (a, b) =>
        Number(Boolean(b.headline)) - Number(Boolean(a.headline)) ||
        b.points.length - a.points.length ||
        a.metric.localeCompare(b.metric),
    );
}

function Latest({ s }: { s: Series }) {
  const last = lastActual(s) ?? s.points[s.points.length - 1];
  if (!last) return null;
  return (
    <span className="font-mono text-sm tabular-nums text-fg-primary">
      <Figure
        className="figure-target figure-standalone"
        source={last.source}
        sourceLabel={last.publisher}
        asOf={periodLabel(last.date)}
      >
        {formatPoint(last)}
      </Figure>{' '}
      <span className="text-xs text-fg-muted">
        {s.unit} · {periodLabel(last.date)}
      </span>
    </span>
  );
}

/**
 * Numbers the company itself reports, as the corpus has read them: a backlog,
 * an order book, an output capacity. Charted from the committed series, every
 * point a link to the page it was read from.
 */
const numbers: ProfileModule<Numbers> = {
  id: 'numbers',
  title: t('profile.numbers.title'),
  appliesTo: ['company'],
  importance: 30,
  load(entity: Entity) {
    if (entity.kind !== 'company') return null;
    const p = participantBySlug(entity.key);
    if (!p) return null;
    const series = companySeries(p.name);
    return series.length > 0 ? { name: p.name, series } : null;
  },
  evidence: ({ series }) =>
    `${series.length} series · ${series.reduce((n, s) => n + s.points.length, 0)} dated points`,
  Render({ data: { series } }) {
    const charted = series.slice(0, CHARTED);
    const rest = series.slice(CHARTED);
    return (
      <>
        <div className="grid gap-8 lg:grid-cols-2">
          {charted.map((s) => {
            const on = bottleneckBySlug(s.bottleneck);
            return (
              <div key={s.id} className="min-w-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <Link
                    href={seriesHref(s.id)}
                    className="link-target font-medium text-fg-primary hover:underline"
                  >
                    {s.metric}
                  </Link>
                  <Latest s={s} />
                </div>
                <p className={`mt-0.5 ${CAPS}`}>
                  {KIND_LABEL[s.kind]} · {s.unit}
                  {on && (
                    <>
                      {' · '}
                      <Link href={bottleneckHref(on.slug)} className="tap hover:underline">
                        {on.name}
                      </Link>
                    </>
                  )}
                </p>
                <LineChart
                  series={[
                    {
                      id: s.id,
                      label: s.metric,
                      points: s.points.map((pt) => ({
                        x: pt.date,
                        y: pt.value,
                        href: pt.source,
                        note: pt.publisher,
                      })),
                    },
                  ]}
                  unit={s.unit}
                  caption={`${s.metric}, ${s.unit}, ${periodLabel(s.points[0].date)} to ${periodLabel(s.points[s.points.length - 1].date)}; every point links to the page it was read from.`}
                  height={176}
                />
              </div>
            );
          })}
        </div>
        {rest.length > 0 && (
          <ul className="mt-6 divide-y divide-subtle border-y border-subtle">
            {rest.map((s) => (
              <li
                key={s.id}
                className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[1fr_auto_auto]"
              >
                <span className="col-span-2 min-w-0 sm:col-span-1">
                  <Link
                    href={seriesHref(s.id)}
                    className="link-target font-medium text-fg-primary underline-offset-4 hover:underline"
                  >
                    {s.metric}
                  </Link>
                  <span className={`mt-0.5 block ${CAPS}`}>
                    {KIND_LABEL[s.kind]} · {s.points.length} points
                  </span>
                </span>
                <Sparkline
                  points={s.points.map((pt) => ({ x: pt.date, y: pt.value }))}
                  label={`${s.metric}, ${s.points.length} points`}
                />
                <Latest s={s} />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 max-w-prose text-xs leading-relaxed text-fg-muted">
          Read from the company&rsquo;s own reports and calls by hand and committed with the
          sentence each number came from; nothing is interpolated.{' '}
          <Link href="/data/series" className={LINK}>
            Every series
          </Link>
        </p>
      </>
    );
  },
};

export { numbers };
