import React from 'react';

import { formatPoint, formatValue, periodLabel, type Series } from '@/lib/series';
import { geometry, linePath } from '@/lib/series-chart';

/**
 * One series, drawn at any width.
 *
 * The line is an SVG stretched to the plot; every point is a real link to the
 * page its number came from, laid over the line, with its value, period and
 * publisher on hover and on keyboard focus. The same values are in the table
 * under each chart, so nothing here is reachable only by pointing.
 */
export function SeriesChart({ series }: { series: Series }) {
  const { placed, ticks } = geometry(series.points);
  const first = series.points[0];
  const last = series.points[series.points.length - 1];
  const dense = placed.length > 40;
  return (
    <figure className="series-chart">
      <figcaption className="sr-only">
        {series.metric}, {series.unit}, {periodLabel(first.date)} to {periodLabel(last.date)}. Every
        value is listed in the table below.
      </figcaption>
      <div className="series-plot">
        {ticks.map((tick) => (
          <div key={tick.value} className="series-grid" style={{ top: `${tick.y}%` }}>
            <span className="series-tick">{formatValue(tick.value)}</span>
          </div>
        ))}
        <svg
          className="series-line"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
          focusable="false"
        >
          <path d={linePath(placed)} vectorEffect="non-scaling-stroke" />
        </svg>
        {placed.map(({ point, x, y }) => (
          <a
            key={point.date}
            href={point.source}
            target="_blank"
            rel="noopener noreferrer"
            className={`series-dot${dense ? ' series-dot-dense' : ''}${x > 66 ? ' series-dot-end' : ''}`}
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <span className="series-tip" role="tooltip">
              <strong>
                {formatPoint(point)} {series.unit}
              </strong>
              <span>
                {periodLabel(point.date)}
                {point.preliminary ? ' · preliminary' : ''}
              </span>
              <span>{point.publisher} ↗</span>
            </span>
          </a>
        ))}
      </div>
      <div className="series-axis" aria-hidden>
        <span>{periodLabel(first.date)}</span>
        {series.points.length > 1 && <span>{periodLabel(last.date)}</span>}
      </div>
    </figure>
  );
}

/** The shape of a series in a line of text: no axis, the last point marked. */
export function Sparkline({ series }: { series: Series }) {
  if (series.points.length < 2) return null;
  const { placed } = geometry(series.points);
  const end = placed[placed.length - 1];
  return (
    <svg
      className="series-spark"
      viewBox="-3 -8 106 116"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Trend over ${series.points.length} points`}
    >
      <path d={linePath(placed)} vectorEffect="non-scaling-stroke" />
      <circle cx={end.x} cy={end.y} r="0.1" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
