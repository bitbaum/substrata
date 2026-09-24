import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

import { INVESTMENT_THESIS } from '@/config/substrata-acting';
import {
  CONFIDENCE_LABEL,
  SCORING_THRESHOLD,
  VERDICT_LABEL,
  isOverdue,
  openCalls,
  record,
  resolvedCalls,
  type Call,
} from '@/config/substrata-calls';
import { Empty, Heading, Page, SectionHeader, Shell } from '@/components/portal/Shell';
import { Figure } from '@/components/portal/Figure';
import { bottleneckHref } from '@/lib/links';

export const metadata: Metadata = {
  title: 'Calls',
  description:
    'Dated predictions with the observation that would settle each one, scored in public including the wrong ones.',
};

const CLAIM_LABEL = Object.fromEntries(INVESTMENT_THESIS.map((c) => [c.id, c.claim]));

const VERDICT_DOT = {
  right: 'bg-status-positive',
  wrong: 'bg-status-negative',
  unclear: 'bg-fg-muted',
} as const;

function CallCard({ call }: { call: Call }) {
  const overdue = isOverdue(call);
  return (
    <li className="py-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-xs tabular-nums text-fg-tertiary">{call.madeOn}</span>
        {call.resolution ? (
          <span className="inline-flex items-center gap-2 text-sm text-fg-secondary">
            <span
              aria-hidden
              className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${VERDICT_DOT[call.resolution.verdict]}`}
            />
            {VERDICT_LABEL[call.resolution.verdict]}
          </span>
        ) : (
          <span className="font-mono text-xs uppercase tracking-caps text-fg-muted">Open</span>
        )}
        <span className="font-mono text-xs uppercase tracking-caps text-fg-muted">
          {CONFIDENCE_LABEL[call.confidence]}
        </span>
        <span
          className={['font-mono text-xs', overdue ? 'text-status-warning' : 'text-fg-muted'].join(
            ' ',
          )}
        >
          {overdue ? 'overdue since' : 'resolves by'} {call.resolveBy}
        </span>
      </div>

      <p className="mt-2 max-w-prose text-lg leading-relaxed text-fg-primary">{call.claim}</p>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-fg-secondary">{call.reasoning}</p>

      <dl className="mt-4 grid gap-x-8 gap-y-3 border-l-2 border-subtle pl-4 sm:grid-cols-2">
        <div>
          <dt className="font-mono text-xs uppercase tracking-caps text-fg-muted">
            What would settle it
          </dt>
          <dd className="mt-0.5 max-w-prose text-sm leading-relaxed text-fg-secondary">
            {call.settledBy}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-xs uppercase tracking-caps text-fg-muted">
            The view it tests
          </dt>
          <dd className="mt-0.5 max-w-prose text-sm leading-relaxed text-fg-secondary">
            <Link
              href="/thesis"
              className="underline-offset-4 hover:text-fg-primary hover:underline"
            >
              {CLAIM_LABEL[call.tests]}
            </Link>
          </dd>
        </div>
      </dl>

      {call.resolution && (
        <p className="mt-3 max-w-prose rounded border-l-2 border-strong bg-surface-raised px-4 py-2 text-sm leading-relaxed text-fg-secondary">
          <span className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
            Marked {call.resolution.on} ·{' '}
          </span>
          {call.resolution.why}
        </p>
      )}

      <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        <span className="font-mono uppercase tracking-caps text-fg-muted">About</span>
        {call.bottlenecks.map((name) => (
          <Link
            key={name}
            href={bottleneckHref(name)}
            className="text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
          >
            {name}
          </Link>
        ))}
      </p>
    </li>
  );
}

export default function CallsPage() {
  const open = openCalls();
  const resolved = resolvedCalls();
  const score = record();

  return (
    <Shell currentPath="calls">
      <Page>
        <SectionHeader
          title="Calls"
          lede="Predictions with a date and with the observation that would settle them. This is the part of the research that can be wrong, which is the part worth judging it on."
          stats={[
            {
              label: 'Open',
              value: <Figure method="call-counts">{score.open}</Figure>,
              note: 'waiting on the world',
            },
            {
              label: 'Resolved',
              value: (
                <Figure method="call-counts">{score.right + score.wrong + score.unclear}</Figure>
              ),
              note: `${score.right} right · ${score.wrong} wrong · ${score.unclear} unclear`,
            },
            {
              label: 'Overdue',
              value: <Figure method="call-counts">{score.overdue}</Figure>,
              note: score.overdue === 0 ? 'nothing past its date' : 'past the date, not yet marked',
            },
            {
              label: 'Hit rate',
              value: score.enoughToScore ? (
                <Figure method="call-counts">
                  {Math.round((score.right / (score.right + score.wrong)) * 100)}%
                </Figure>
              ) : (
                '—'
              ),
              note: score.enoughToScore
                ? 'of resolved calls'
                : `not published until ${SCORING_THRESHOLD} have resolved`,
            },
          ]}
        />

        <div className="mb-8 rounded-lg border border-strong bg-surface-raised px-5 py-4">
          <p className="max-w-prose text-sm leading-relaxed text-fg-secondary">
            <span className="font-medium text-fg-primary">How this is kept honest.</span> A call is
            published with the date it was made and the observation that settles it, so it cannot be
            quietly reinterpreted later. Wrong calls stay on this page with the same weight as right
            ones. No hit rate is shown until {SCORING_THRESHOLD} have resolved, because a percentage
            computed from a handful is noise wearing a number.
          </p>
        </div>

        <section className="mb-14">
          <Heading index="01" title="Open" aside={`${open.length}, soonest to resolve first`} />
          {open.length === 0 ? (
            <Empty what="No open calls." />
          ) : (
            <ul className="divide-y divide-subtle border-y border-subtle">
              {open.map((call) => (
                <CallCard key={call.id} call={call} />
              ))}
            </ul>
          )}
        </section>

        <section>
          <Heading index="02" title="Resolved" aside={`${resolved.length}`} />
          {resolved.length === 0 ? (
            <Empty
              what="Nothing has resolved yet."
              next={`The first of these comes due ${open[0]?.resolveBy ?? 'later'}.`}
            />
          ) : (
            <ul className="divide-y divide-subtle border-y border-subtle">
              {resolved.map((call) => (
                <CallCard key={call.id} call={call} />
              ))}
            </ul>
          )}
        </section>
      </Page>
    </Shell>
  );
}
