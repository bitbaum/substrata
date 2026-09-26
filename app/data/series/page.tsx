import React from 'react';
import Link from 'next/link';

import { Figure } from '@/components/portal/Figure';
import { Empty, Page, Shell } from '@/components/portal/Shell';
import { PageHeader } from '@/components/portal/PageHeader';
import { AutoSubmitForm } from '@/components/portal/AutoSubmitForm';
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
/** Rows drawn at once. Each carries a sparkline; all 145 made a 1 MB page. */
const PAGE = 40;

export default async function SeriesIndex({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { series: all, officialOk } = await allSeries();
  const kind = params.kind && params.kind in KIND_LABEL ? (params.kind as SeriesKind) : undefined;
  const origin = params.origin === 'official' || params.origin === 'corpus' ? params.origin : '';
  const q = (params.q ?? '').trim().toLowerCase().slice(0, 80);
  const rail = BOTTLENECKS.find((b) => b.slug === params.b);
  const names = new Map(BOTTLENECKS.map((b) => [b.slug, b.name]));
  const limit = Math.min(Math.max(Number(params.n) || PAGE, PAGE), 400);
  const shown = all
    .filter(
      (s) =>
        (!rail || s.bottleneck === rail.slug) &&
        (!kind || s.kind === kind) &&
        (!origin || s.origin === origin) &&
        (!q ||
          `${s.metric} ${s.geography} ${s.unit} ${names.get(s.bottleneck) ?? ''}`
            .toLowerCase()
            .includes(q)),
    )
    .sort(byRelevance);
  const withSeries = BOTTLENECKS.filter((b) => all.some((s) => s.bottleneck === b.slug));
  const points = shown.reduce((n, s) => n + s.points.length, 0);
  const more = new URLSearchParams(
    Object.entries({ ...params, n: String(limit + PAGE) }).flatMap(([k, v]) => (v ? [[k, v]] : [])),
  ).toString();

  return (
    <Shell>
      <Page>
        <PageHeader
          kicker="Data"
          title="Data series"
          status={
            <>
              <Figure method="series-points">{String(shown.length)}</Figure> series ·{' '}
              <Figure method="series-points">{String(points)}</Figure> dated points ·{' '}
              <Figure method="series-points">{String(withSeries.length)}</Figure> bottlenecks
              covered · newest change first within each measure
            </>
          }
          note="Lead times, prices, capacity, output, backlogs and trade volumes. Every value links the page it came from; official statistics say which agency published them. Each series downloads as CSV."
        />
        <AutoSubmitForm action="/data/series" className="desk-filters">
          <label className="desk-filter desk-filter-q">
            <span className="sr-only">Search series</span>
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search: gallium, backlog, US…"
              maxLength={80}
            />
          </label>
          <label className="desk-filter">
            <span className="sr-only">Bottleneck</span>
            <select name="b" defaultValue={rail?.slug ?? ''}>
              <option value="">All bottlenecks</option>
              {withSeries.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="desk-filter">
            <span className="sr-only">Measure</span>
            <select name="kind" defaultValue={kind ?? ''}>
              <option value="">All measures</option>
              {Object.entries(KIND_LABEL)
                .filter(([k]) => all.some((s) => s.kind === k))
                .map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
            </select>
          </label>
          <label className="desk-filter">
            <span className="sr-only">Origin</span>
            <select name="origin" defaultValue={origin}>
              <option value="">Any origin</option>
              <option value="corpus">Read from sources</option>
              <option value="official">Official statistics (API)</option>
            </select>
          </label>
        </AutoSubmitForm>
        {!officialOk && (
          <p className="series-origin">
            Official statistics could not be read just now; only series read from sources are
            listed.
          </p>
        )}
        {shown.length === 0 ? (
          <Empty
            what="No series match these filters."
            next="Search reads the measure, the place, the unit and the bottleneck's name."
            action={
              <>
                <Link href="/data/series">Clear the filters</Link>
                <Link href="/bottlenecks">Browse the bottlenecks</Link>
              </>
            }
          />
        ) : (
          <ul className="series-index">
            {shown.slice(0, limit).map((s) => {
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
        {shown.length > limit && (
          <p className="list-more">
            <Link href={`/data/series?${more}`} scroll={false}>
              Show more ({shown.length - limit} left)
            </Link>
          </p>
        )}
      </Page>
    </Shell>
  );
}
