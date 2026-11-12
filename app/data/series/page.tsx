import React from 'react';
import Link from 'next/link';
import { applyQuery, matches, parseQuery, type ListSpec } from 'listkit';

import { Figure } from '@/components/portal/Figure';
import { Empty, Page, Shell } from '@/components/portal/Shell';
import { PageHeader } from '@/components/portal/PageHeader';
import { AutoSubmitForm } from '@/components/portal/AutoSubmitForm';
import { SeriesSparkline } from '@/components/series/SeriesChart';
import { ChangeBadge } from '@/components/series/SeriesParts';
import { BOTTLENECKS } from '@/lib/bottlenecks';
import { bottleneckHref, seriesHref } from '@/lib/links';
import {
  KIND_LABEL,
  byRelevance,
  formatPoint,
  isPlanned,
  periodLabel,
  type Series,
} from '@/lib/series';
import { moreHref, rowsShown, shownQuery } from '@/lib/list-more';
import { allSeries } from '@/lib/series-store';
import { textFilter } from '@/lib/text-filter';

export const metadata = {
  title: 'Data series',
  description:
    'Lead times, prices, capacity, output, backlogs and trade volumes on each bottleneck — dated, sourced and downloadable.',
};
export const dynamic = 'force-dynamic';

type Params = Record<string, string | string[] | undefined>;
/** Rows drawn at once. Each carries a sparkline; all 145 made a 1 MB page. */
const PAGE = 40;
/** The most rows "Show more" will ever draw. */
const MAX = 400;

/**
 * The index's filters: a bottleneck (`b`), a measure and an origin, each one
 * value; a value no option carries filters nothing. Rows keep the order they
 * are given in (`byRelevance`: newest change first within each measure).
 */
const SERIES_SPEC: ListSpec<Series> = {
  facets: [
    { key: 'b', kind: 'one', value: (s) => s.bottleneck, options: BOTTLENECKS.map((b) => b.slug) },
    { key: 'kind', kind: 'one', value: (s) => s.kind, options: Object.keys(KIND_LABEL) },
    { key: 'origin', kind: 'one', value: (s) => s.origin, options: ['official', 'corpus'] },
  ],
  sorts: [{ key: 'relevance-order', by: [] }],
  defaultSort: 'relevance-order',
  defaultPageSize: PAGE,
};

export default async function SeriesIndex({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { series: all, officialOk } = await allSeries();
  const typedRaw = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = shownQuery(
    {
      ...parseQuery(params, SERIES_SPEC, { maxPageSize: MAX }),
      q: (typedRaw ?? '').trim().slice(0, 80),
    },
    rowsShown(params, PAGE, MAX),
  );
  const chosen = (key: string) => query.facets[key]?.[0] ?? '';
  const names = new Map(BOTTLENECKS.map((b) => [b.slug, b.name]));
  const typed = textFilter(
    all,
    {
      fields: [
        { name: 'metric', get: (s) => s.metric },
        { name: 'geography', get: (s) => s.geography },
        { name: 'bottleneck', get: (s) => names.get(s.bottleneck) },
        { name: 'unit', get: (s) => s.unit },
      ],
    },
    query.q,
  );
  // Typed words through searchkit (a slip forgiven); the facets and the rows
  // drawn through listkit.
  const pool = all.filter(typed).sort(byRelevance);
  const facetsOnly = { ...query, q: '' };
  const result = applyQuery(pool, SERIES_SPEC, facetsOnly);
  const shown = result.matched;
  const left = shown - result.rows.length;
  const withSeries = BOTTLENECKS.filter((b) => all.some((s) => s.bottleneck === b.slug));
  const points = matches(pool, SERIES_SPEC, facetsOnly).reduce((n, s) => n + s.points.length, 0);

  return (
    <Shell>
      <Page>
        <PageHeader
          kicker="Data"
          title="Data series"
          status={
            <>
              <Figure method="series-points">{String(shown)}</Figure> series ·{' '}
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
              defaultValue={query.q}
              placeholder="Search: gallium, backlog, US…"
              maxLength={80}
            />
          </label>
          <label className="desk-filter">
            <span className="sr-only">Bottleneck</span>
            <select name="b" defaultValue={chosen('b')}>
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
            <select name="kind" defaultValue={chosen('kind')}>
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
            <select name="origin" defaultValue={chosen('origin')}>
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
        {shown === 0 ? (
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
            {result.rows.map((s) => {
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
                    <SeriesSparkline series={s} />
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
        {left > 0 && (
          <p className="list-more">
            <Link href={moreHref('/data/series', params, query, SERIES_SPEC, PAGE)} scroll={false}>
              Show more ({left} left)
            </Link>
          </p>
        )}
      </Page>
    </Shell>
  );
}
