import React from 'react';
import { LineChart, Sparkline } from '@bitbaum/chartkit/react';

import { formatPoint, periodLabel, type Series } from '@/lib/series';

/**
 * A series drawn by the fleet's chart package, @bitbaum/chartkit. This file
 * is only the join between Substrata's data model and the package's
 * contract: which field is the x, which the y, what the tooltip says. The
 * drawing, the axis arithmetic, the tooltip, the lanes and the audit that
 * no label clips live in the package, so a fix there reaches every product.
 *
 * Every point is a link to the page its number came from, with its value,
 * period and publisher on hover and on keyboard focus; the same values are
 * in the table under each chart and in the figure's own hidden table.
 */
function points(series: Series) {
  return series.points.map((p) => ({
    x: p.date,
    y: p.value,
    href: p.source,
    preliminary: p.preliminary,
    // A range ("80–210 weeks") is drawn at its upper end and stated in full.
    note: p.low !== undefined ? `${p.publisher} · range ${formatPoint(p)}` : p.publisher,
  }));
}

export function SeriesChart({ series }: { series: Series }) {
  const first = series.points[0];
  const last = series.points[series.points.length - 1];
  return (
    <div className="series-chart">
      <LineChart
        series={[{ id: series.id, label: series.metric, points: points(series) }]}
        unit={series.unit}
        caption={`${series.metric}, ${series.unit}, ${periodLabel(first.date)} to ${periodLabel(last.date)}. Every value is listed in the table below.`}
      />
    </div>
  );
}

/** The shape of a series in a line of text: no axis, the last point marked. */
export function SeriesSparkline({ series }: { series: Series }) {
  return (
    <Sparkline
      points={points(series)}
      label={`${series.metric}: trend over ${series.points.length} points`}
    />
  );
}
