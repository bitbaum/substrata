/**
 * Data series as desk rows: what a reader following a rail should hear about.
 *
 * Two triggers, one row each: the newest point on every series on the rail
 * (so a new value arrives on the desk the day it does), and any earlier point
 * that moved at least ALERT_PCT against the one before it (so a jump is not
 * buried under the next quiet month). A backfill of an official series brings
 * years of months in at once; only the newest and the moves reach the desk.
 */
import type { DeskItem } from '@/lib/desk';
import {
  ALERT_PCT,
  changeBetween,
  effectOf,
  formatPct,
  formatPoint,
  periodLabel,
  periodTime,
  type Series,
  type SeriesPoint,
} from '@/lib/series';

/** When a point reached the reader: first fetched, else published, else its own period. */
export function pointTime(point: SeriesPoint): string {
  if (point.firstSeen) return point.firstSeen;
  const published = point.published ? periodTime(point.published) : NaN;
  const at = Number.isFinite(published) ? published : periodTime(point.date);
  return new Date(at).toISOString();
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * @param names bottleneck slug → the rail name the desk filters on, for the
 *   reader's rails only; series on other bottlenecks produce nothing.
 */
export function seriesItems(
  series: readonly Series[],
  names: ReadonlyMap<string, string>,
): DeskItem[] {
  return series.flatMap((s): DeskItem[] => {
    const name = names.get(s.bottleneck);
    if (!name || s.points.length === 0) return [];
    const last = s.points.length - 1;
    return s.points.flatMap((point, i): DeskItem[] => {
      const change = i > 0 ? changeBetween(s.points[i - 1], point) : undefined;
      const moved = change?.pct !== undefined && Math.abs(change.pct) >= ALERT_PCT;
      if (i !== last && !moved) return [];
      const move =
        change?.pct !== undefined
          ? ` — ${formatPct(change.pct)} vs ${periodLabel(change.from.date)}`
          : '';
      return [
        {
          source: 'series',
          id: `${s.id}:${point.date}`,
          at: pointTime(point),
          title: `${s.metric} (${s.geography}): ${formatPoint(point)} ${s.unit} for ${periodLabel(point.date)}${move}`,
          url: point.source,
          host: hostOf(point.source),
          bottlenecks: [name],
          effect: moved ? effectOf(s, change) : 'neutral',
          moved,
          official: s.origin === 'official',
          dateOnly: !point.firstSeen,
        },
      ];
    });
  });
}
