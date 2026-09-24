import React from 'react';
import Link from 'next/link';

import { Figure } from '@/components/portal/Figure';
import { formatValue, periodLabel, KIND_LABEL, type Series } from '@/lib/series';
import { seriesHref } from '@/lib/links';
import { ChangeBadge, OriginNote, PointsTable } from './SeriesParts';
import { SeriesChart, Sparkline } from './SeriesChart';

/**
 * The dated numbers on one bottleneck, first thing on its page.
 *
 * Each row is the latest value of one series — what it measures, in what unit,
 * for which period, from which page — with its move against the point before
 * and a sparkline. Opening a row shows the full chart and every point with the
 * sentence it was read from.
 */
export function KeyNumbers({ series, officialOk }: { series: Series[]; officialOk: boolean }) {
  return (
    <>
      <ul className="series-keys">
        {series.map((s, index) => {
          const last = s.points[s.points.length - 1];
          return (
            <li key={s.id}>
              <details className="series-key" open={index === 0}>
                <summary>
                  <span className="series-key-metric">
                    <span className="series-key-kind">
                      {KIND_LABEL[s.kind]} · {s.geography}
                    </span>
                    {s.metric}
                  </span>
                  <span className="series-key-value">
                    <Figure
                      source={last.source}
                      sourceLabel={last.publisher}
                      asOf={periodLabel(last.date)}
                    >
                      {formatValue(last.value)}
                    </Figure>{' '}
                    <span className="series-unit">{s.unit}</span>
                    <span className="series-key-date">
                      {periodLabel(last.date)}
                      {last.preliminary ? ', preliminary' : ''}
                    </span>
                  </span>
                  <span className="series-key-trend">
                    <Sparkline series={s} />
                    <ChangeBadge series={s} />
                  </span>
                </summary>
                <div className="series-key-body">
                  {s.describes && <p className="series-describes">{s.describes}</p>}
                  {s.points.length > 1 && <SeriesChart series={s} />}
                  <PointsTable series={s} limit={6} />
                  <OriginNote series={s} />
                  <p className="series-links">
                    <Link href={seriesHref(s.id)}>Series page</Link>
                    <a href={`${seriesHref(s.id)}/csv`} download>
                      Download CSV
                    </a>
                  </p>
                </div>
              </details>
            </li>
          );
        })}
      </ul>
      {!officialOk && (
        <p className="series-origin">
          Official statistics could not be read just now; only the series read from sources are
          shown.
        </p>
      )}
      <p className="series-origin">
        <Link href="/data/series">Every series on every bottleneck</Link> — filter, compare and
        download.
      </p>
    </>
  );
}
