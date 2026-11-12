import { LineChart } from '@bitbaum/chartkit/react';

import type { RunRecord } from '@/lib/quality/store';

/** A dataset's score in one run: the mean of its criterion scores, as the page computes it. */
export function scoreInRun(run: RunRecord, dataset: string): number | null {
  const lines = run.scores.filter((s) => s.dataset === dataset && s.checked > 0);
  if (lines.length === 0) return null;
  return lines.reduce((n, s) => n + (s.passed / s.checked) * 100, 0) / lines.length;
}

/**
 * The score over the stored runs, as a line drawn by @bitbaum/chartkit's
 * LineChart; nothing drawn until there are two runs. The axis runs to 100%,
 * the ceiling every criterion aims at, and starts no higher than 80% so a
 * small dip is not drawn as a collapse.
 */
export function Trend({ runs, dataset }: { runs: RunRecord[] | null; dataset: string }) {
  if (runs === null)
    return <p className="quality-note">The run history could not be read just now.</p>;
  const points = runs
    .map((r) => ({ at: r.startedAt, score: scoreInRun(r, dataset) }))
    .filter((p): p is { at: string; score: number } => p.score !== null);
  if (points.length < 2)
    return (
      <p className="quality-note">
        Trend: {points.length === 0 ? 'no scheduled run recorded yet' : 'one run recorded so far'}.
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
        caption={`Score from ${first.score.toFixed(1)}% on ${first.at.slice(0, 10)} to ${last.score.toFixed(1)}% on ${last.at.slice(0, 10)}, over ${points.length} runs.`}
      />
    </div>
  );
}
