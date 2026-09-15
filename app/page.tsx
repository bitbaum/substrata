import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

import { COMPANY } from '@/config/substrata';
import { HORIZON_LABEL } from '@/config/substrata-assessment';
import {
  EVENTS,
  candidatesAwaiting,
  eventsNewestFirst,
  eventsSince,
} from '@/config/substrata-events';
import { RESEARCH_PROGRAMMES, programmeProgress } from '@/config/substrata-programmes';
import { STAGES } from '@/config/substrata-stages';
import { BOTTLENECKS, portalTotals } from '@/lib/bottlenecks';
import { BindingBar } from '@/components/portal/Board';
import { EventList } from '@/components/portal/EventList';
import { Heading, Page, Shell } from '@/components/portal/Shell';
import { Status } from '@/components/portal/Status';

export const metadata: Metadata = {
  title: { absolute: `${COMPANY.name} — bottlenecks on the path to transformative technology` },
  description: COMPANY.tagline,
};

const WINDOW_DAYS = 30;

/**
 * Today: what moved. The front page is a diff, because a diff is the only
 * thing worth reading twice. Numbers first, then the events of the last
 * thirty days, then the nodes binding now, then where the loop is covered.
 */
export default function TodayPage() {
  const totals = portalTotals();
  const recent = eventsSince(WINDOW_DAYS);
  const tightening = new Set(
    recent.filter((e) => e.effect === 'tightens').flatMap((e) => e.bottlenecks),
  );
  const loosening = new Set(
    recent.filter((e) => e.effect === 'loosens').flatMap((e) => e.bottlenecks),
  );
  const bindingNow = BOTTLENECKS.filter((b) => b.horizon === 'now').sort(
    (a, b) => b.binding - a.binding,
  );
  const programme = RESEARCH_PROGRAMMES[0];
  const progress = programmeProgress(programme);
  const candidates = candidatesAwaiting();
  const latest = eventsNewestFirst()[0];

  const tiles = [
    {
      label: `Events, last ${WINDOW_DAYS} days`,
      value: recent.length,
      note: `${EVENTS.length} accepted in total · ${candidates} candidates awaiting review`,
    },
    {
      label: 'Tightening',
      value: tightening.size,
      note: `${loosening.size} loosening. Bottlenecks touched by an accepted event.`,
    },
    {
      label: 'Binding now',
      value: totals.bindingNow,
      note: `of ${totals.bottlenecks} bottlenecks, by the analyst's horizon.`,
    },
    {
      label: 'Rows verified',
      value: totals.sourced,
      note: `of ${totals.producers} producer rows · ${totals.candidates} candidates`,
    },
  ];

  return (
    <Shell currentPath="">
      <Page>
        <header className="mb-8">
          <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
            Today · {latest ? `latest event ${latest.date}` : 'no events yet'}
          </p>
          <h1 className="mt-3 max-w-3xl font-heading text-3xl font-semibold leading-tight tracking-display text-fg-primary sm:text-5xl">
            What moved among the constraints on technological progress.
          </h1>
          <p className="mt-3 max-w-2xl text-base text-fg-secondary">
            Every constraint progress waits on, dated, sourced, and marked as tightening or
            loosening.
          </p>
        </header>

        <dl className="mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-subtle bg-border-subtle lg:grid-cols-4">
          {tiles.map((tile) => (
            <div key={tile.label} className="bg-surface-raised px-4 py-4 sm:px-5">
              <dt className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                {tile.label}
              </dt>
              <dd className="mt-2 font-heading text-3xl font-semibold tabular-nums text-fg-primary sm:text-4xl">
                {tile.value}
              </dd>
              <dd className="mt-1 text-xs text-fg-muted">{tile.note}</dd>
            </div>
          ))}
        </dl>

        <Heading
          index="01"
          title={`Last ${WINDOW_DAYS} days`}
          aside={
            <Link
              href="/events"
              className="underline-offset-4 hover:text-fg-primary hover:underline"
            >
              All events →
            </Link>
          }
        />
        <EventList events={recent} />

        <div className="mt-14 grid gap-10 lg:grid-cols-[3fr_2fr]">
          <section>
            <Heading
              index="02"
              title="Binding now"
              aside={
                <Link
                  href="/board?horizon=now"
                  className="underline-offset-4 hover:text-fg-primary hover:underline"
                >
                  On the board →
                </Link>
              }
            />
            <ol className="divide-y divide-subtle border-y border-subtle">
              {bindingNow.map((b) => (
                <li
                  key={b.slug}
                  className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-2.5"
                >
                  <Link
                    href={`/bottlenecks/${b.slug}`}
                    className="min-w-0 flex-1 text-fg-primary underline-offset-4 hover:underline"
                  >
                    {b.name}
                    {tightening.has(b.name) && (
                      <span className="ml-2 font-mono text-xs uppercase tracking-caps text-status-negative">
                        tightening
                      </span>
                    )}
                    {loosening.has(b.name) && (
                      <span className="ml-2 font-mono text-xs uppercase tracking-caps text-status-positive">
                        loosening
                      </span>
                    )}
                  </Link>
                  <span className="flex items-center gap-4">
                    <BindingBar value={b.binding} />
                    <Status state={b.state} compact />
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-3 font-mono text-xs text-fg-muted">
              {HORIZON_LABEL.now} · {bindingNow.length} nodes · judged {bindingNow[0]?.judgedOn}
            </p>
          </section>

          <section>
            <Heading
              index="03"
              title="The loop"
              aside={
                <Link
                  href="/research"
                  className="underline-offset-4 hover:text-fg-primary hover:underline"
                >
                  Research →
                </Link>
              }
            />
            <ol className="divide-y divide-subtle border-y border-subtle">
              {STAGES.map((stage) => {
                const count = BOTTLENECKS.filter((b) => b.stage === stage.id).length;
                return (
                  <li key={stage.id} className="flex items-baseline justify-between gap-4 py-2">
                    {count > 0 ? (
                      <Link
                        href={`/board?stage=${stage.id}`}
                        className="text-fg-primary underline-offset-4 hover:underline"
                      >
                        {stage.name}
                      </Link>
                    ) : (
                      <span className="text-fg-tertiary">{stage.name}</span>
                    )}
                    <span className="font-mono text-xs tabular-nums text-fg-muted">
                      {count > 0 ? `${count} covered` : 'not yet'}
                    </span>
                  </li>
                );
              })}
            </ol>
            <Link
              href="/research"
              className="mt-4 block rounded-lg border border-subtle bg-surface-raised p-4 transition-colors hover:border-strong"
            >
              <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                Programme · since {programme.commissioned}
              </p>
              <p className="mt-1 font-heading text-lg font-semibold text-fg-primary">
                {programme.title}
              </p>
              <p className="mt-1 font-mono text-xs text-fg-muted">
                {programme.questions.length} open questions · {progress.done}/{progress.total}{' '}
                delivered
              </p>
            </Link>
          </section>
        </div>
      </Page>
    </Shell>
  );
}
