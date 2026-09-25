import React from 'react';
import Link from 'next/link';

import { Figure } from '@/components/portal/Figure';
import { Page, Shell, SectionHeader } from '@/components/portal/Shell';
import { Sparkline } from '@/components/series/SeriesChart';
import { ChangeBadge } from '@/components/series/SeriesParts';
import { BOTTLENECKS } from '@/lib/bottlenecks';
import { bottleneckHref, seriesHref } from '@/lib/links';
import {
  KIND_LABEL,
  byRelevance,
  formatPoint,
  isPlanned,
  periodLabel,
  type SeriesKind,
} from '@/lib/series';
import { allSeries } from '@/lib/series-store';

export const metadata = {
  title: 'Data series',
  description:
    'Lead times, prices, capacity, output, backlogs and trade volumes on each bottleneck — dated, sourced and downloadable.',
};
export const dynamic = 'force-dynamic';

type Params = Record<string, string | undefined>;

export default async function SeriesIndex({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { series: all, officialOk } = await allSeries();
  const kind = params.kind && params.kind in KIND_LABEL ? (params.kind as SeriesKind) : undefined;
  const origin = params.origin === 'official' || params.origin === 'corpus' ? params.origin : '';
  const q = (params.q ?? '').trim().toLowerCase().slice(0, 80);
  const rail = BOTTLENECKS.find((b) => b.slug === params.b);
  const shown = all
    .filter(
      (s) =>
        (!rail || s.bottleneck === rail.slug) &&
        (!kind || s.kind === kind) &&
        (!origin || s.origin === origin) &&
        (!q || `${s.metric} ${s.geography} ${s.unit}`.toLowerCase().includes(q)),
    )
    .sort(byRelevance);
  const names = new Map(BOTTLENECKS.map((b) => [b.slug, b.name]));
  const withSeries = BOTTLENECKS.filter((b) => all.some((s) => s.bottleneck === b.slug));
  const points = shown.reduce((n, s) => n + s.points.length, 0);

  return (
    <Shell>
      <Page>
        <SectionHeader
          title="Data series"
          lede="Dated numbers on each bottleneck: lead times, prices, capacity, output, backlogs and trade volumes. Every value links the page it came from; official statistics say which agency published them."
          stats={[
            { label: 'Series', value: <Figure method="series-points">{shown.length}</Figure> },
            { label: 'Points', value: <Figure method="series-points">{points}</Figure> },
            {
              label: 'Bottlenecks covered',
              value: <Figure method="series-points">{withSeries.length}</Figure>,
            },
          ]}
        />
        <form className="series-filters" method="get">
          <label>
            <span>Bottleneck</span>
            <select name="b" defaultValue={rail?.slug ?? ''}>
              <option value="">All</option>
              {withSeries.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Measure</span>
            <select name="kind" defaultValue={kind ?? ''}>
              <option value="">All</option>
              {Object.entries(KIND_LABEL)
                .filter(([k]) => all.some((s) => s.kind === k))
                .map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span>Origin</span>
            <select name="origin" defaultValue={origin}>
              <option value="">All</option>
              <option value="corpus">Read from sources</option>
              <option value="official">Official statistics (API)</option>
            </select>
          </label>
          <label className="series-filter-q">
            <span>Search</span>
            <input name="q" defaultValue={params.q ?? ''} placeholder="gallium, backlog, US…" />
          </label>
          <button className="research-button-ghost">Filter</button>
        </form>
        {!officialOk && (
          <p className="series-origin">
            Official statistics could not be read just now; only series read from sources are
            listed.
          </p>
        )}
        {shown.length === 0 ? (
          <p className="series-origin">
            No series match. <Link href="/data/series">Clear the filters</Link>.
          </p>
        ) : (
          <ul className="series-index">
            {shown.map((s) => {
              const last = s.points[s.points.length - 1];
              return (
                <li key={s.id} className="series-row">
                  <div className="series-row-main">
                    <p className="series-key-kind">
                      {KIND_LABEL[s.kind]} · {s.geography} ·{' '}
                      <Link href={bottleneckHref(s.bottleneck)}>{names.get(s.bottleneck)}</Link>
                      {s.origin === 'official' ? ' · official statistics' : ''}
                    </p>
                    <Link href={seriesHref(s.id)} className="series-row-title">
                      {s.metric}
                    </Link>
                  </div>
                  <div className="series-row-value">
                    <Figure source={last.source} sourceLabel={last.publisher}>
                      {formatPoint(last)}
                    </Figure>{' '}
                    <span className="series-unit">{s.unit}</span>
                    <span className="series-key-date">
                      {periodLabel(last.date)}
                      {isPlanned(last) ? ' · target or forecast' : ''}
                    </span>
                  </div>
                  <div className="series-key-trend">
                    <Sparkline series={s} />
                    <ChangeBadge series={s} />
                  </div>
                  <a className="series-row-csv" href={`${seriesHref(s.id)}/csv`} download>
                    CSV
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </Page>
    </Shell>
  );
}
