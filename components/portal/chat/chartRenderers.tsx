import type { ReactNode } from 'react';
import type { ChartBlock } from '@bitbaum/chatkit';
import type { RichRenderers } from '@bitbaum/chatkit/react';
import { BarChart, LineChart, ShareBars, StatTiles, Timeline } from '@bitbaum/chartkit/react';

/**
 * Charts in answers (chatkit 0.15): chatkit validates the model's `chart`
 * block and leaves the drawing to the app. Here the drawing is the fleet's
 * chart package, the same figures the series pages and company profiles
 * draw, so a bar chart in an answer is the bar chart on /resources.
 *
 * The one translation: chatkit carries shares as percent (0–100, what a
 * model writes); chartkit takes fractions (0–1). Everything else spreads.
 * A kind this does not draw returns null, and chatkit draws its table.
 */
export function renderChart(b: ChartBlock): ReactNode {
  switch (b.chart) {
    case 'bars':
      return (
        <BarChart
          caption={b.caption}
          unit={b.unit}
          highlight={b.highlight}
          rows={b.rows.map((r) => ({
            label: r.label,
            value: r.value,
            href: r.href,
            share: r.share === undefined ? undefined : r.share / 100,
            note: r.note,
            estimated: r.estimated,
          }))}
        />
      );
    case 'share':
      return (
        <ShareBars
          caption={b.caption}
          other={b.other === undefined ? undefined : b.other / 100}
          rows={b.rows.map((r) => ({ label: r.label, share: r.share / 100, href: r.href }))}
        />
      );
    case 'line':
      return <LineChart caption={b.caption} unit={b.unit} series={b.series} />;
    case 'timeline':
      return <Timeline caption={b.caption} events={b.events} />;
    case 'tiles':
      return <StatTiles caption={b.caption} tiles={b.tiles} />;
    default:
      return null;
  }
}

/** Passed to every chat Substrata draws: the panel, /chat, the dock. */
export const chartRenderers: RichRenderers = { chart: renderChart };
