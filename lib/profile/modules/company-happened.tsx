import Link from 'next/link';

import { EventList } from '@/components/portal/EventList';
import { Timeline, type TimelineEvent } from '@bitbaum/chartkit/react';
import { EVENT_KIND_LABEL, type CoverageEvent, type EventEffect } from '@/config/substrata-events';
import { FORM_LABEL, filingHeadline, type Filing } from '../../filings';
import type { CompanyProfile } from '../../company-profile';
import { hostOf, whenLabel } from '../../desk';
import { bottleneckHref } from '../../links';
import { t } from '../../i18n/messages';
import type { ProfileModule } from '../types';
import { CAPS, LINK, profile } from './company';

// ---------------------------------------------------------------------------
// What has happened: one axis for its own events, events on what it holds
// and (when the page has them) its SEC filings; then the lists.
// ---------------------------------------------------------------------------

const TONE: Record<EventEffect, TimelineEvent['tone']> = {
  tightens: 'up',
  loosens: 'down',
  neutral: 'neutral',
};

/** Events and filings as one dated list, for the axis. */
export function timelineOf(p: CompanyProfile, filings: readonly Filing[]): TimelineEvent[] {
  const own: TimelineEvent[] = p.events.map((e) => ({
    date: e.date,
    label: e.headline,
    href: `#${e.id}`,
    tone: TONE[e.effect],
    kind: 'Names it',
  }));
  const related: TimelineEvent[] = p.relatedEvents.map(({ event }) => ({
    date: event.date,
    label: event.headline,
    tone: TONE[event.effect],
    kind: 'What it holds',
  }));
  const filed: TimelineEvent[] = filings.map((f) => ({
    date: f.filedOn,
    label: `SEC ${f.form}: ${filingHeadline(f, p.participant.name)}`,
    href: f.url,
    tone: 'neutral',
    kind: 'SEC filing',
  }));
  return [...own, ...related, ...filed].sort((a, b) => a.date.localeCompare(b.date));
}

export function WhatHappened({
  p,
  filings = [],
}: {
  p: CompanyProfile;
  filings?: readonly Filing[];
}) {
  const now = new Date();
  const related = p.relatedEvents.slice(0, 6);
  const axis = timelineOf(p, filings);
  return (
    <>
      {axis.length > 1 && (
        <Timeline
          events={axis}
          caption={`Every dated row on this page on one axis: events that name ${p.participant.name}, events on what it holds${filings.length > 0 ? ', and its filings with the SEC' : ''}. Red tightens, green loosens. The lists below carry the sources.`}
        />
      )}
      {p.events.length > 0 && (
        <>
          <h3 className={`${axis.length > 1 ? 'mt-6 ' : ''}mb-2 ${CAPS}`}>
            Names {p.participant.name}
          </h3>
          <EventList events={p.events} showBottlenecks />
        </>
      )}
      {related.length > 0 && (
        <>
          <h3
            className={`${p.events.length > 0 ? 'mt-8' : axis.length > 1 ? 'mt-6' : ''} mb-2 ${CAPS}`}
          >
            About what it holds, not naming {p.participant.name}
          </h3>
          <ul className="divide-y divide-subtle border-y border-subtle">
            {related.map(({ event, through }) => (
              <li key={event.id} className="py-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-xs tabular-nums text-fg-tertiary">
                    {event.date}
                  </span>
                  <span className={CAPS}>{EVENT_KIND_LABEL[event.kind]}</span>
                  <Link
                    href={bottleneckHref(through.slug)}
                    className={`${CAPS} tap underline-offset-4 hover:text-fg-primary hover:underline`}
                  >
                    {through.name}
                  </Link>
                </div>
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-primary">
                  {event.headline}{' '}
                  <a href={event.source} rel="noreferrer" className={`text-xs ${LINK}`}>
                    {hostOf(event.source)} ↗
                  </a>
                </p>
              </li>
            ))}
          </ul>
          {p.relatedEvents.length > related.length && (
            <p className="mt-2 text-xs text-fg-muted">
              {p.relatedEvents.length - related.length} more on the bottleneck pages.
            </p>
          )}
        </>
      )}
      {filings.length > 0 && (
        <>
          <h3 className={`${p.events.length + related.length > 0 ? 'mt-8' : ''} mb-2 ${CAPS}`}>
            Filed with the SEC
          </h3>
          <ul className="divide-y divide-subtle border-y border-subtle">
            {filings.map((f) => (
              <li key={f.accession} className="py-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span
                    className="font-mono text-xs tabular-nums text-fg-tertiary"
                    title={f.acceptedAt}
                  >
                    {whenLabel(f.acceptedAt, now)}
                  </span>
                  <span className={CAPS} title={FORM_LABEL[f.form] ?? f.form}>
                    SEC {f.form}
                  </span>
                </div>
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-primary">
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-4 hover:underline"
                  >
                    {filingHeadline(f, p.participant.name).replace(`${p.participant.name} — `, '')}
                  </a>{' '}
                  <span className="text-xs text-fg-tertiary">sec.gov ↗</span>
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-2 max-w-prose text-xs leading-relaxed text-fg-muted">
            The company&rsquo;s own filings, from SEC EDGAR, fetched hourly. Substrata has not
            judged their effect on any bottleneck.
          </p>
        </>
      )}
      <p className="mt-3 text-sm">
        <Link href="/events" className={LINK}>
          {t('action.allEvents')}
        </Link>
      </p>
    </>
  );
}

/** "3 name it · 2 about what it holds · 8 filings" */
export function happenedEvidence(p: CompanyProfile, filings = 0): string {
  return [
    p.events.length > 0 ? `${p.events.length} name it` : '',
    p.relatedEvents.length > 0 ? `${p.relatedEvents.length} about what it holds` : '',
    filings > 0 ? `${filings} SEC filings` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

const companyEvents: ProfileModule<CompanyProfile> = {
  id: 'events',
  title: t('profile.companyEvents.title'),
  appliesTo: ['company'],
  importance: 40,
  load(entity) {
    const p = profile(entity);
    return p && (p.events.length > 0 || p.relatedEvents.length > 0) ? p : null;
  },
  evidence: (p) => happenedEvidence(p),
  Render({ data: p }) {
    return <WhatHappened p={p} />;
  },
};

/** For the header tile: how many and the newest date, across own and related rows. */
export function eventSummary(p: CompanyProfile): { count: number; newest: CoverageEvent | null } {
  const all = [...p.events, ...p.relatedEvents.map((r) => r.event)];
  const newest = all.reduce<CoverageEvent | null>(
    (best, e) => (!best || e.date > best.date ? e : best),
    null,
  );
  return { count: p.events.length, newest };
}

export { companyEvents };
