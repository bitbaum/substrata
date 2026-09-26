import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Page, Shell } from '@/components/portal/Shell';
import { SeriesChart } from '@/components/series/SeriesChart';
import { ChangeBadge, OriginNote, PointsTable } from '@/components/series/SeriesParts';
import { bottleneckBySlug } from '@/lib/bottlenecks';
import { bottleneckHref, seriesHref } from '@/lib/links';
import { KIND_LABEL, seriesById } from '@/lib/series';
import { allSeries } from '@/lib/series-store';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { id } = await params;
  const series = seriesById((await allSeries()).series, id);
  return series ? { title: `${series.metric} — ${series.geography}` } : {};
}

/** One series in full: the chart, every point with its source and quote, and a CSV. */
export default async function SeriesPage({ params }: RouteParams) {
  const { id } = await params;
  const series = seriesById((await allSeries()).series, id);
  if (!series) notFound();
  const bottleneck = bottleneckBySlug(series.bottleneck);
  return (
    <Shell>
      <Page>
        <nav
          aria-label="Breadcrumb"
          className="crumbs mb-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary"
        >
          <Link href="/data/series" className="hover:text-fg-primary">
            Data series
          </Link>
          {bottleneck && (
            <>
              <span className="mx-2">/</span>
              <Link href={bottleneckHref(bottleneck.slug)} className="hover:text-fg-primary">
                {bottleneck.name}
              </Link>
            </>
          )}
        </nav>
        <header className="series-head">
          <p className="series-key-kind">
            {KIND_LABEL[series.kind]} · {series.geography} · {series.unit}
          </p>
          <h1>{series.metric}</h1>
          <ChangeBadge series={series} />
          {series.describes && <p className="series-describes">{series.describes}</p>}
        </header>
        <SeriesChart series={series} />
        <PointsTable series={series} />
        <OriginNote series={series} />
        <p className="series-links">
          <a href={`${seriesHref(series.id)}/csv`} download>
            Download CSV
          </a>
          {bottleneck && <Link href={bottleneckHref(bottleneck.slug)}>{bottleneck.name}</Link>}
        </p>
      </Page>
    </Shell>
  );
}
