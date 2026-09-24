import Link from 'next/link';

import { Figure } from '@/components/portal/Figure';
import { Sparkline } from '@/components/series/SeriesChart';
import { ChangeBadge } from '@/components/series/SeriesParts';
import { BOTTLENECKS } from '@/lib/bottlenecks';
import { seriesHref } from '@/lib/links';
import {
  KIND_LABEL,
  formatPoint,
  isPlanned,
  latestChange,
  periodLabel,
  periodTime,
  type Series,
  type SeriesKind,
} from '@/lib/series';

const YEAR_MS = 366 * 86_400_000;

/**
 * Series of these kinds whose latest actual move is within a year, largest
 * move first — "what moved", with plans and old history left out.
 */
export function biggestMoves(
  all: readonly Series[],
  kinds: readonly SeriesKind[],
  limit: number,
  now = Date.now(),
): Series[] {
  return all
    .filter((s) => kinds.includes(s.kind))
    .flatMap((s) => {
      const change = latestChange(s);
      if (!change || change.pct === undefined || isPlanned(change.to)) return [];
      if (now - periodTime(change.to.date) > YEAR_MS) return [];
      return [{ s, size: Math.abs(change.pct) }];
    })
    .sort((a, b) => b.size - a.size)
    .slice(0, limit)
    .map(({ s }) => s);
}

/** Compact series rows: what, latest value with its source, the trend and the move. */
export function SeriesRows({ series }: { series: readonly Series[] }) {
  const names = new Map(BOTTLENECKS.map((b) => [b.slug, b.name]));
  if (series.length === 0) return <p className="role-empty">No series match yet.</p>;
  return (
    <ul className="role-series">
      {series.map((s) => {
        const last = s.points[s.points.length - 1];
        return (
          <li key={s.id}>
            <div className="role-series-main">
              <Link href={seriesHref(s.id)} className="role-row-title">
                {s.metric}
              </Link>
              <span className="role-row-meta">
                {KIND_LABEL[s.kind]} · {s.geography} · {names.get(s.bottleneck)}
              </span>
            </div>
            <div className="role-series-value">
              <Figure source={last.source} sourceLabel={last.publisher}>
                {formatPoint(last)}
              </Figure>{' '}
              <span className="role-row-meta">
                {s.unit} · {periodLabel(last.date)}
              </span>
              <span className="role-series-trend">
                <Sparkline series={s} />
                <ChangeBadge series={s} />
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
