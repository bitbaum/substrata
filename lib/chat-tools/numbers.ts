/**
 * The numbers behind a bottleneck, for the assistant.
 *
 * The record the model read had no numbers at all, so "how long is the wait
 * for a large power transformer?" was answered "more than two years" while 139
 * dated, sourced series sat on the site (lead times in weeks, prices, capacity).
 * Each row here is a figure with its date, its source and its evidence state,
 * so the model can quote a number instead of a horizon word.
 */
import {
  corpusSeries,
  formatPct,
  formatPoint,
  isPlanned,
  lastActual,
  latestChange,
  seriesFor,
  type Series,
} from '../series';
import { str, type ChatTool } from './tool';

const KEY_NUMBERS = 3;

function row(s: Series) {
  const last = lastActual(s);
  const change = latestChange(s);
  const planned = s.points.filter((p) => isPlanned(p)).at(-1);
  return {
    metric: s.metric,
    figure: last ? `${formatPoint(last)} ${s.unit}, ${s.geography}, ${last.date}` : null,
    // In words, not a signed percentage: "+83.5% from 352.8" was read back as a
    // fall (2026-10-02). The direction is stated, so it cannot be reversed.
    change:
      change && change.pct !== undefined
        ? `${change.pct >= 0 ? 'up' : 'down'} ${formatPct(Math.abs(change.pct)).replace(/^[+−-]/, '')} from ${formatPoint(change.from)} ${s.unit} (${change.from.date}) to the latest figure`
        : undefined,
    planned: planned ? `${formatPoint(planned)} ${s.unit} planned for ${planned.date}` : undefined,
    source: last ? `${last.publisher}${last.primary ? ' (primary)' : ''}: ${last.source}` : null,
    page: `/data/series/${s.id}`,
  };
}

/** The most relevant series for a bottleneck slug, newest value first; empty when none exist. */
export function keyNumbers(slug: string, limit = KEY_NUMBERS) {
  return seriesFor(corpusSeries(), slug)
    .filter((s) => lastActual(s))
    .slice(0, limit)
    .map(row);
}

/**
 * Series found by what they measure, across every bottleneck: "tin price"
 * finds the tin price series. Asked for the tin price trend, the assistant
 * read a production table and said prices were not tracked (2026-10-02).
 */
export function findSeries(query: string, limit = 5) {
  const words = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !['the', 'and', 'for', 'with', 'trend', 'what'].includes(w));
  if (!words.length) return [];
  return corpusSeries()
    .filter((s) => lastActual(s))
    .map((s) => {
      const hay = `${s.metric} ${s.bottleneck} ${s.kind} ${s.unit} ${s.geography}`.toLowerCase();
      return { s, score: words.filter((w) => hay.includes(w)).length };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ s }) => ({ bottleneck: s.bottleneck, ...row(s) }));
}

export const NUMBER_TOOLS: ChatTool[] = [
  {
    name: 'find_numbers',
    description:
      'Dated, sourced number series found by what they measure — prices, lead times, capacity, output, backlogs, trade volumes — across all bottlenecks. Use for "price of X", "trend", "how much", when no single bottleneck record answers it.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'e.g. "tin price", "transformer lead time"' },
      },
      required: ['query'],
    },
    label: (a) => `Looking up the numbers for "${str(a.query)}"`,
    async run(a) {
      const rows = findSeries(str(a.query));
      return rows.length
        ? { series: rows, note: 'Each row: latest figure with date, the change, and its source.' }
        : { note: `No number series matches "${str(a.query)}".` };
    },
  },
];
