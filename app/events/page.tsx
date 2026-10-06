import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { applyQuery, parseQuery, writeQuery, type ListQuery, type ListSpec } from 'listkit';

import {
  EVENT_EFFECT_LABEL,
  EVENT_KIND_LABEL,
  eventsNewestFirst,
  type CoverageEvent,
  type EventEffect,
  type EventKind,
} from '@/config/substrata-events';
import { STAGES, STAGE_LABEL, type StageId } from '@/config/substrata-stages';
import { bottleneckByName } from '@/lib/bottlenecks';
import { Chip } from '@/components/portal/Chip';
import { EventList } from '@/components/portal/EventList';
import { FeedRow } from '@/components/portal/FeedRow';
import { Heading, Page, Shell } from '@/components/portal/Shell';
import { whenLabel } from '@/lib/desk';
import { HOME_LEAD_DAYS, recentFinds } from '@/lib/home-feed';
import { UpdateNews } from '@/components/updates/UpdateNews';

export const metadata: Metadata = {
  title: 'News',
  description:
    'What changed in the supply chains behind compute, power and machines: checked events with their source sentence, and the newest finds marked not yet checked.',
};

/** Finds shown above the checked events: enough to read as a feed, few enough to scan. */
const FINDS_SHOWN = 10;
/** A web sweep older than this and the page says the news may be stale. */
const STALE_HOURS = 24;

type SearchParams = Record<string, string | string[] | undefined>;

const KINDS = Object.keys(EVENT_KIND_LABEL) as EventKind[];
const EFFECTS = Object.keys(EVENT_EFFECT_LABEL) as EventEffect[];

function stagesOf(event: CoverageEvent): StageId[] {
  return [
    ...new Set(event.bottlenecks.map((name) => bottleneckByName(name)?.stage).filter(Boolean)),
  ] as StageId[];
}

const EVENT_SPEC: ListSpec<CoverageEvent> = {
  facets: [
    { key: 'effect', kind: 'one', value: (e) => e.effect, options: EFFECTS },
    { key: 'kind', kind: 'one', value: (e) => e.kind, options: KINDS },
    { key: 'stage', kind: 'one', value: (e) => stagesOf(e), options: STAGES.map((s) => s.id) },
  ],
  search: { text: (e) => [e.headline, e.quote, ...e.bottlenecks, ...e.participants] },
  sorts: [{ key: 'date', by: [(e) => e.date] }],
  defaultSort: 'date',
  defaultDir: 'desc',
  defaultPageSize: 200,
};

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const now = new Date();
  const query = parseQuery(params, EVENT_SPEC);
  const { found, leadsRead, freshness } = await recentFinds(now, { limit: FINDS_SHOWN });
  const newest = eventsNewestFirst()[0];
  const sweptAt = freshness?.lastRunAt ? new Date(freshness.lastRunAt).getTime() : 0;
  const stale = now.getTime() - sweptAt > STALE_HOURS * 3_600_000;

  const result = applyQuery(eventsNewestFirst(), EVENT_SPEC, query);

  const hrefFor = (next: ListQuery) => {
    const qs = writeQuery(params, next, EVENT_SPEC, query).toString();
    return qs ? `/events?${qs}` : '/events';
  };
  const withFacet = (key: string, values: string[]): ListQuery => ({
    ...query,
    page: 1,
    facets: { ...query.facets, [key]: values },
  });
  const selected = (key: string) => query.facets[key] ?? [];
  const counts = (key: string) => result.counts[key] ?? {};
  // Kind and stage fold away unless one of them is in use.
  const narrowed = selected('kind').length > 0 || selected('stage').length > 0;

  const row = (
    label: string,
    key: string,
    options: readonly string[],
    labelOf: (v: string) => string,
  ) => (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 w-14 font-mono text-xs uppercase tracking-caps text-fg-tertiary">
        {label}
      </span>
      <Chip href={hrefFor(withFacet(key, []))} active={selected(key).length === 0} label="All" />
      {options
        .filter((v) => (counts(key)[v] ?? 0) > 0 || selected(key).includes(v))
        .map((v) => (
          <Chip
            key={v}
            href={hrefFor(withFacet(key, [v]))}
            active={selected(key).includes(v)}
            label={labelOf(v)}
            count={counts(key)[v] ?? 0}
          />
        ))}
    </div>
  );

  return (
    <Shell>
      <Page sections>
        <header className="mb-8 max-w-2xl">
          <h1 className="font-heading text-3xl font-semibold tracking-display text-fg-primary sm:text-4xl">
            News
          </h1>
          <p className="mt-2 text-base leading-relaxed text-fg-secondary">
            What changed in the supply chains behind compute, power and machines. The newest finds
            come first, marked not yet checked; below them, events a person has read, each with the
            sentence that says so.
          </p>
          <p className="mt-3 font-mono text-xs text-fg-tertiary">
            {freshness?.lastRunAt
              ? `Web sweep ran ${whenLabel(freshness.lastRunAt, now)}`
              : 'Web sweep: no run recorded'}
            {newest && (
              <>
                {' · newest checked event '}
                <span className="whitespace-nowrap">{newest.date}</span>
              </>
            )}{' '}
            ·{' '}
            <Link href="/data/freshness" className="underline underline-offset-2">
              how fresh is this?
            </Link>
          </p>
          {stale && (
            <p className="mt-3 text-sm text-fg-primary">
              The web has not been searched for {STALE_HOURS} hours or more, so these may be out of
              date. Anyone can search now; it takes under a minute and uses no AI.
            </p>
          )}
          <div className="mt-4">
            <UpdateNews scope={{ kind: 'all' }} refreshPage showLeads={false} />
          </div>
        </header>

        <Heading
          index="01"
          title="Just found"
          aside={`last ${HOME_LEAD_DAYS} days · not yet checked`}
        />
        {!leadsRead ? (
          <p className="py-4 text-sm text-fg-tertiary">
            The sweep&apos;s finds could not be read just now.
          </p>
        ) : found.length === 0 ? (
          <p className="py-4 text-sm text-fg-tertiary">
            Nothing the sweep found in the last {HOME_LEAD_DAYS} days reports a change.
          </p>
        ) : (
          <ol className="home-feed mb-12">
            {found.map((item) => (
              <FeedRow key={`${item.source}:${item.id}`} item={item} now={now} />
            ))}
          </ol>
        )}

        <Heading
          index="02"
          title="Checked events"
          aside={
            <Link
              href="/api/events"
              className="underline-offset-4 hover:text-fg-primary hover:underline"
            >
              As JSON →
            </Link>
          }
        />
        <div className="flex flex-col gap-3 border-y border-subtle py-4">
          {row('Effect', 'effect', EFFECTS, (v) => EVENT_EFFECT_LABEL[v as EventEffect])}
          <details open={narrowed} className="group">
            <summary className="cursor-pointer font-mono text-xs uppercase tracking-caps text-fg-tertiary hover:text-fg-primary">
              More filters
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              {row('Kind', 'kind', KINDS, (v) => EVENT_KIND_LABEL[v as EventKind])}
              {row(
                'Stage',
                'stage',
                STAGES.map((s) => s.id),
                (v) => STAGE_LABEL[v as StageId],
              )}
            </div>
          </details>
        </div>
        <EventList events={result.rows} byMonth />
        <p className="mt-3 font-mono text-xs text-fg-muted">
          {result.matched} of {result.total}
        </p>
      </Page>
    </Shell>
  );
}
