/**
 * Events as a list: date, effect, kind, one line, the bottlenecks it bears
 * on, and where it comes from. The source's name is always shown — a reader
 * deciding whether to trust a line needs it before opening anything — and the
 * quoted sentence sits one click away. With `byMonth`, a month heading
 * precedes each month's events so a long list reads as a timeline.
 */

import React from 'react';
import Link from 'next/link';

import {
  EVENT_EFFECT_LABEL,
  EVENT_KIND_LABEL,
  type CoverageEvent,
  type EventEffect,
} from '@/config/substrata-events';
import { bottleneckHref, marketHref } from '@/lib/links';
import { CheckThis } from './CheckThis';

const EFFECT_DOT: Record<EventEffect, string> = {
  tightens: 'bg-status-negative',
  loosens: 'bg-status-positive',
  neutral: 'bg-fg-muted',
};

export function EffectMark({ effect }: { effect: EventEffect }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-fg-secondary">
      <span
        aria-hidden
        className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${EFFECT_DOT[effect]}`}
      />
      {EVENT_EFFECT_LABEL[effect]}
    </span>
  );
}

const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
// Date-only strings are anchored at noon UTC so no timezone moves them a day.
const monthOf = (date: string) => MONTH.format(new Date(`${date.slice(0, 7)}-15T12:00:00Z`));

export function EventList({
  events,
  showBottlenecks = true,
  byMonth = false,
}: {
  events: readonly CoverageEvent[];
  showBottlenecks?: boolean;
  byMonth?: boolean;
}) {
  if (events.length === 0) {
    return <p className="py-6 text-sm text-fg-tertiary">No accepted events yet.</p>;
  }
  return (
    <ol className="divide-y divide-subtle border-y border-subtle">
      {events.map((event, i) => (
        <React.Fragment key={event.id}>
          {byMonth && monthOf(event.date) !== (i > 0 ? monthOf(events[i - 1].date) : '') && (
            <li className="pb-2 pt-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary">
              {monthOf(event.date)}
            </li>
          )}
          <li
            id={event.id}
            className="grid scroll-mt-24 gap-x-6 gap-y-1 py-3 sm:grid-cols-[7rem_1fr]"
          >
            <div className="font-mono text-xs tabular-nums text-fg-tertiary">{event.date}</div>
            <div>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <EffectMark effect={event.effect} />
                <span className="font-mono text-xs uppercase tracking-caps text-fg-muted">
                  {EVENT_KIND_LABEL[event.kind]}
                </span>
                {event.jurisdictions.length > 0 && (
                  <span className="font-mono text-xs text-fg-muted">
                    {event.jurisdictions.join(' ')}
                  </span>
                )}
              </div>
              <p className="mt-1 font-medium leading-snug text-fg-primary">{event.headline}</p>
              {showBottlenecks && (
                <p className="mt-1 flex flex-wrap gap-x-3 text-xs">
                  {event.bottlenecks.map((name) => (
                    <Link
                      key={name}
                      href={bottleneckHref(name)}
                      className="text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
                    >
                      {name}
                    </Link>
                  ))}
                </p>
              )}
              {event.participants.length > 0 && (
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  <span className="font-mono uppercase tracking-caps text-fg-muted">Who</span>
                  {event.participants.map((name) => (
                    <Link
                      key={name}
                      href={marketHref(name)}
                      className="text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
                    >
                      {name}
                    </Link>
                  ))}
                </p>
              )}
              <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
                <a
                  href={event.source}
                  rel="noreferrer"
                  className="text-fg-secondary underline underline-offset-4 hover:text-fg-primary"
                >
                  {new URL(event.source).hostname.replace(/^www\./, '')} ↗
                </a>
                <span className="text-fg-muted">
                  {event.primary ? 'official source' : 'secondary source'}
                </span>
              </p>
              <details className="mt-1 text-xs">
                <summary className="cursor-pointer text-fg-tertiary hover:text-fg-primary">
                  The sentence that says so
                </summary>
                <p className="mt-1 max-w-prose leading-relaxed text-fg-tertiary">“{event.quote}”</p>
                <CheckThis
                  className="is-inline"
                  claim={`${event.date}: ${event.headline}`}
                  source={event.source}
                />
              </details>
            </div>
          </li>
        </React.Fragment>
      ))}
    </ol>
  );
}
