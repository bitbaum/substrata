import React from 'react';

import { periodTime } from '@/lib/series';

// ---------------------------------------------------------------------------
// Timeline — dated events on one axis, newest at the right. The axis is a
// picture of when; the list under it (the caller's) carries the links.
// ---------------------------------------------------------------------------

export type TimelineTone = 'up' | 'down' | 'neutral';

export interface TimelineEvent {
  /** YYYY-MM-DD, or any period lib/series understands. */
  date: string;
  label: string;
  href?: string;
  tone?: TimelineTone;
  /** A short word for what kind of thing it is: "Capacity", "SEC 6-K". */
  kind?: string;
}

const YEAR = 365.25 * 24 * 3600 * 1000;

export function Timeline({
  events,
  caption,
  legend,
}: {
  events: TimelineEvent[];
  caption?: React.ReactNode;
  /** What the three tones mean on this page. */
  legend?: Partial<Record<TimelineTone, string>>;
}) {
  if (events.length === 0) return null;
  const times = events.map((e) => periodTime(e.date));
  let t0 = Math.min(...times);
  let t1 = Math.max(...times);
  // One event, or events on one day: give the axis a month either side.
  if (t1 - t0 < YEAR / 12) {
    t0 -= YEAR / 24;
    t1 += YEAR / 24;
  }
  // Breathing room so the first and last dots are not on the edge.
  const pad = (t1 - t0) * 0.04;
  t0 -= pad;
  t1 += pad;
  const px = (t: number) => ((t - t0) / (t1 - t0)) * 100;
  // Year ticks where the span allows; months when it is under two years.
  const ticks: { at: number; label: string }[] = [];
  const start = new Date(t0);
  const monthly = t1 - t0 < 2 * YEAR;
  const cursor = new Date(
    Date.UTC(start.getUTCFullYear(), monthly ? start.getUTCMonth() + 1 : 0, 1),
  );
  if (!monthly && cursor.getTime() < t0) cursor.setUTCFullYear(cursor.getUTCFullYear() + 1);
  while (cursor.getTime() <= t1) {
    const at = cursor.getTime();
    if (at >= t0)
      ticks.push({
        at,
        label: monthly
          ? cursor.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }) +
            (cursor.getUTCMonth() === 0 ? ` ${cursor.getUTCFullYear()}` : '')
          : String(cursor.getUTCFullYear()),
      });
    if (monthly) cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCFullYear(cursor.getUTCFullYear() + 1);
  }
  // Too many monthly ticks for a phone: keep every other one.
  const shown =
    ticks.length > 8 ? ticks.filter((_, i) => i % Math.ceil(ticks.length / 8) === 0) : ticks;
  const kinds = [...new Set(events.map((e) => e.kind).filter(Boolean))] as string[];
  return (
    <figure className="ck-timeline">
      <div className="ck-timeline-axis" role="img" aria-label={`${events.length} dated events`}>
        {shown.map((t) => (
          <span key={t.at} className="ck-timeline-tick" style={{ left: `${px(t.at)}%` }}>
            {t.label}
          </span>
        ))}
        {kinds.length > 1 ? (
          kinds.map((kind, lane) => (
            <div key={kind} className="ck-timeline-lane" data-lane={lane}>
              <span className="ck-timeline-lane-label">{kind}</span>
              {events
                .filter((e) => e.kind === kind)
                .map((e, i) => (
                  <span
                    key={`${e.date}:${i}`}
                    className={`ck-timeline-dot is-${e.tone ?? 'neutral'}`}
                    style={{ left: `${px(periodTime(e.date))}%` }}
                    title={`${e.date} · ${e.label}`}
                  />
                ))}
            </div>
          ))
        ) : (
          <div className="ck-timeline-lane" data-lane={0}>
            {events.map((e, i) => (
              <span
                key={`${e.date}:${i}`}
                className={`ck-timeline-dot is-${e.tone ?? 'neutral'}`}
                style={{ left: `${px(periodTime(e.date))}%` }}
                title={`${e.date} · ${e.label}`}
              />
            ))}
          </div>
        )}
      </div>
      {(legend || caption) && (
        <figcaption className="ck-caption">
          {legend && (
            <span className="ck-legend ck-legend-tones">
              {(['up', 'down', 'neutral'] as const)
                .filter((tone) => legend[tone])
                .map((tone) => (
                  <span key={tone} className={`is-${tone}`}>
                    {legend[tone]}
                  </span>
                ))}
            </span>
          )}
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
