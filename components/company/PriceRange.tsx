'use client';

import { useState } from 'react';
import { LineChart } from '@bitbaum/chartkit/react';

import type { RangeView } from '@/lib/company-page/price-view';
import { Delta } from './parts';

/**
 * The page's one client island: the range row and the chart it switches.
 * Every range is computed on the server (lib/company-page/price-view.ts) and
 * sent whole — six series of at most 120 closes — so switching reads nothing.
 * The row is one row of equal cells at every width.
 */
export function PriceRange({
  views,
  initial = '1Y',
  currency,
  caption,
}: {
  views: RangeView[];
  initial?: RangeView['range'];
  currency: string;
  caption: string;
}) {
  const [range, setRange] = useState(initial);
  const view = views.find((v) => v.range === range) ?? views[0];
  return (
    <div className="mk-price">
      <div className="mk-range" role="group" aria-label="Price range">
        {views.map((v) => (
          <button
            key={v.range}
            type="button"
            className="mk-range-option"
            aria-pressed={v.range === range}
            onClick={() => setRange(v.range)}
          >
            {v.range}
          </button>
        ))}
      </div>
      <dl className="mk-figures">
        <div>
          <dt>Return over {view.range}</dt>
          <dd>
            <Delta display={view.change} direction={view.direction} />{' '}
            <span className="mk-figure-detail">{view.changeDetail}</span>
          </dd>
        </div>
        <div>
          <dt>Lowest to highest close</dt>
          <dd>{view.span}</dd>
        </div>
        <div>
          <dt>Largest fall from a peak</dt>
          <dd>{view.drawdown}</dd>
        </div>
      </dl>
      {view.points.length > 1 ? (
        <LineChart
          key={view.range}
          series={[{ id: view.range, label: 'Close', points: view.points }]}
          unit={currency}
          yFrom="data"
          height={240}
          // A long range is a line with a light fill, as on a quote page: no
          // dot per close (chartkit drops them above 60 points); each close
          // still shows its value on hover and keyboard focus, and the table
          // behind the chart holds them all. A short range keeps its dots.
          markers="auto"
          area
          caption={`${caption} Range: ${view.range}, ${view.points[0].x} to ${view.points.at(-1)!.x}.`}
        />
      ) : (
        <p className="mk-empty">Fewer than two closes in this range.</p>
      )}
    </div>
  );
}
