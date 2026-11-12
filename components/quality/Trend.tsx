import { LineChart } from '@bitbaum/chartkit/react';

import type { RunRecord } from '@/lib/quality/store';

/** A dataset's score in one run: the mean of its criterion scores, as the page computes it. */
export function scoreInRun(run: RunRecord, dataset: string): number | null {
  const lines = run.scores.filter((s) => s.dataset === dataset && s.checked > 0);
  if (lines.length === 0) return null;
  return lines.reduce((n, s) => n + (s.passed / s.checked) * 100, 0) / lines.length;
}

/**
 * One point per calendar day: that day's latest run. The run fires every six
 * hours, and chartkit places a point by its date, so four runs a day would
 * otherwise stack on one x and draw as a vertical scribble.
 */
export function latestPerDay<T extends { at: string }>(points: T[]): T[] {
  const byDay = new Map<string, T>();
  for (const p of [...points].sort((a, b) => a.at.localeCompare(b.at)))
    byDay.set(p.at.slice(0, 10), p);
  return [...byDay.values()];
}

/**
 * The score over the stored runs, as a line drawn by @bitbaum/chartkit's
 * LineChart; nothing drawn until there are two days of runs. The axis runs to 100%,
 * the ceiling every criterion aims at, and starts no higher than 80% so a
 * small dip is not drawn as a collapse.
 */
export function Trend({ runs, dataset }: { runs: RunRecord[] | null; dataset: string }) {
  if (runs === null)
    return <p className="quality-note">The run history could not be read just now.</p>;
  const points = latestPerDay(
    runs
      .map((r) => ({ at: r.startedAt, score: scoreInRun(r, dataset) }))
      .filter((p): p is { at: string; score: number } => p.score !== null),
  );
  if (points.length < 2)
    return (
      <p className="quality-note">
        Trend: {points.length === 0 ? 'no scheduled run recorded yet' : 'one day of runs so far'}.
      </p>
    );
  const lo = Math.floor(Math.min(...points.map((p) => p.score), 80) / 10) * 10;
  const first = points[0];
  const last = points[points.length - 1];
  return (
    <div className="quality-trend">
      <LineChart
        series={[
          {
            id: dataset,
            label: 'Score',
            points: points.map((p) => ({
              x: p.at.slice(0, 10),
              y: Math.round(p.score * 10) / 10,
            })),
          },
        ]}
        unit="%"
        yDomain={{ min: lo, max: 100 }}
        height={96}
        markers="auto"
        caption={`Score from ${first.score.toFixed(1)}% on ${first.at.slice(0, 10)} to ${last.score.toFixed(1)}% on ${last.at.slice(0, 10)}, over ${points.length} days (each day's latest run).`}
      />
    </div>
  );
}
