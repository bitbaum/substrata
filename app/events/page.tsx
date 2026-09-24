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
import { Heading, Page, Shell } from '@/components/portal/Shell';

export const metadata: Metadata = {
  title: 'Events',
  description:
    'What happened to each bottleneck, dated and sourced, marked as tightening or loosening.',
};

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
  const query = parseQuery(params, EVENT_SPEC);
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
    <Shell currentPath="events">
      <Page>
        <header className="mb-6">
          <h1 className="font-heading text-3xl font-semibold tracking-display text-fg-primary sm:text-4xl">
            Events
          </h1>
          <p className="mt-2 max-w-2xl text-base text-fg-secondary">
            What happened to a bottleneck, on a date, with the sentence that says so. Each one was
            read and accepted by hand. Leads the automated sweep found are not events until then;{' '}
            <Link href="/data" className="underline underline-offset-2">
              how many are waiting
            </Link>{' '}
            is measured live on the data page.
          </p>
        </header>
        <Heading
          index="01"
          title="Accepted events"
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
          {row('Kind', 'kind', KINDS, (v) => EVENT_KIND_LABEL[v as EventKind])}
          {row(
            'Stage',
            'stage',
            STAGES.map((s) => s.id),
            (v) => STAGE_LABEL[v as StageId],
          )}
        </div>
        <EventList events={result.rows} />
        <p className="mt-3 font-mono text-xs text-fg-muted">
          {result.matched} of {result.total}
        </p>
      </Page>
    </Shell>
  );
}
