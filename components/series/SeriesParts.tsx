import React from 'react';
import Link from 'next/link';

import { Figure } from '@/components/portal/Figure';
import {
  effectOf,
  formatPct,
  formatPoint,
  formatValue,
  isPlanned,
  latestChange,
  periodLabel,
  type Series,
  type SeriesPoint,
} from '@/lib/series';
import { seriesHref } from '@/lib/links';

/** "+12% vs prior point": computed, so it opens its rule rather than a source. */
export function ChangeBadge({ series }: { series: Series }) {
  const change = latestChange(series);
  if (!change || change.pct === undefined) return null;
  const effect = effectOf(series, change);
  return (
    <span className={`series-change series-change-${effect}`}>
      <Figure
        method="series-change"
        detail={`${formatValue(change.from.value)} (${periodLabel(change.from.date)}) → ${formatValue(change.to.value)} (${periodLabel(change.to.date)}).`}
      >
        {formatPct(change.pct)}
      </Figure>{' '}
      vs {periodLabel(change.from.date)}
      {effect !== 'neutral' && <span className="series-change-effect"> · {effect}</span>}
    </span>
  );
}

/** Where the points came from, in the words a reader needs before trusting them. */
export function OriginNote({ series }: { series: Series }) {
  return series.origin === 'official' ? (
    <p className="series-origin">
      <span className="series-origin-tag">Official statistics</span> {series.check}
      {series.checkedOn ? `; last fetched ${series.checkedOn}` : ''}.
    </p>
  ) : (
    <p className="series-origin">
      <span className="series-origin-tag series-origin-tag-agent">Read from the sources</span>{' '}
      {series.check}, {series.checkedOn}. Each value links the page it came from and quotes the
      sentence that carries it.
    </p>
  );
}

function PointRow({ point, unit }: { point: SeriesPoint; unit: string }) {
  return (
    <tr>
      <th scope="row" className="series-td-date">
        {periodLabel(point.date)}
      </th>
      <td className="series-td-value">
        <Figure
          source={point.source}
          sourceLabel={point.publisher}
          asOf={point.published ?? periodLabel(point.date)}
        >
          {formatPoint(point)}
        </Figure>{' '}
        <span className="series-unit">{unit}</span>
        {point.preliminary && <span className="series-flag"> preliminary</span>}
        {isPlanned(point) && <span className="series-flag"> target or forecast</span>}
      </td>
      <td className="series-td-source">
        <a href={point.source} target="_blank" rel="noopener noreferrer">
          {point.publisher} ↗
        </a>
        <span className="series-flag">{point.primary ? ' primary' : ' secondary report'}</span>
        {point.quote && <q className="series-quote">{point.quote}</q>}
        {point.note && <span className="series-note">{point.note}</span>}
      </td>
    </tr>
  );
}

/** Every point, newest first: the chart's table view and its provenance. */
export function PointsTable({ series, limit }: { series: Series; limit?: number }) {
  const rows = [...series.points].reverse();
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <div className="series-table-wrap">
      <table className="series-table">
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Value</th>
            <th scope="col">Source</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((point) => (
            <PointRow key={point.date} point={point} unit={series.unit} />
          ))}
        </tbody>
      </table>
      {shown.length < rows.length && (
        <p className="series-more">
          <Link href={seriesHref(series.id)}>
            All{' '}
            <Figure method="series-points" inLink>
              {rows.length}
            </Figure>{' '}
            points, with the chart and a CSV →
          </Link>
        </p>
      )}
    </div>
  );
}
