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
