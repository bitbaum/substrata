/**
 * Events as a list: date, effect, kind, one line, and the bottlenecks it
 * bears on. The quote and the source sit behind a disclosure so the list
 * scans and the evidence is one click away.
 */

import React from 'react';
import Link from 'next/link';

import {
  EVENT_EFFECT_LABEL,
  EVENT_KIND_LABEL,
  type CoverageEvent,
  type EventEffect,
} from '@/config/substrata-events';
import { slugOf } from '@/lib/bottlenecks';

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

export function EventList({
  events,
  showBottlenecks = true,
}: {
  events: readonly CoverageEvent[];
  showBottlenecks?: boolean;
}) {
  if (events.length === 0) {
    return <p className="py-6 text-sm text-fg-tertiary">No accepted events yet.</p>;
  }
  return (
    <ol className="divide-y divide-subtle border-y border-subtle">
      {events.map((event) => (
        <li key={event.id} className="grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[7rem_1fr]">
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
            <p className="mt-1 text-fg-primary">{event.headline}</p>
            {showBottlenecks && (
              <p className="mt-1 flex flex-wrap gap-x-3 text-xs">
                {event.bottlenecks.map((name) => (
                  <Link
                    key={name}
                    href={`/bottlenecks/${slugOf(name)}`}
                    className="text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
                  >
                    {name}
                  </Link>
                ))}
              </p>
            )}
            <details className="mt-1 text-xs">
              <summary className="cursor-pointer text-fg-tertiary hover:text-fg-primary">
                Source
              </summary>
              <p className="mt-1 max-w-prose leading-relaxed text-fg-tertiary">“{event.quote}”</p>
              <a
                href={event.source}
                rel="noreferrer"
                className="text-accent underline-offset-4 hover:underline"
              >
                {new URL(event.source).hostname} ↗
              </a>
              <span className="ml-2 text-fg-muted">
                {event.primary ? 'official source' : 'secondary source'}
              </span>
            </details>
          </div>
        </li>
      ))}
    </ol>
  );
}
