/**
 * The data series' computed numbers, spread into METHODS in lib/methods.ts —
 * kept here so that file stays one screen of shared rules.
 */
import type { Method } from './methods';
import { MIN_MOVE_PCT } from './series';

export const SERIES_METHODS = {
  'series-change': {
    title: 'Change vs the prior point',
    formula:
      'The latest value in a series minus the value before it, divided by the earlier value, same series and unit.',
    explanation: `Points are compared as published, never interpolated: when the prior point is a year earlier, so is the comparison, and the badge names the period it compares against. Whether a rise tightens or loosens the bottleneck is set per series (a longer lead time tightens; more capacity loosens). A move smaller than ${MIN_MOVE_PCT * 100}% either way is shown with its sign but called flat, not tightening or loosening: surveys and revisions move by that much without anything changing. A target or forecast is never called either way.`,
    code: ['lib/series.ts'],
  },
  'series-points': {
    title: 'Series and points',
    formula:
      'Count of dated values in a series, or of series matching the filters, across the committed corpus and the official statistics fetched on schedule.',
    explanation:
      'Corpus points live in research/series.json with a source link and a quote each; official points come from the BLS public API into the database. A count covers what is held, not everything published.',
    code: ['lib/series.ts', 'lib/series-store.ts', 'research/series.json'],
  },
} as const satisfies Record<string, Method>;
