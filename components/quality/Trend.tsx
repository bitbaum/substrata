import type { RunRecord } from '@/lib/quality/store';

/** A dataset's score in one run: the mean of its criterion scores, as the page computes it. */
export function scoreInRun(run: RunRecord, dataset: string): number | null {
  const lines = run.scores.filter((s) => s.dataset === dataset && s.checked > 0);
  if (lines.length === 0) return null;
  return lines.reduce((n, s) => n + (s.passed / s.checked) * 100, 0) / lines.length;
}

/** The score over the stored runs, as a line; nothing drawn until there are two runs. */
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
  const w = 240;
  const h = 44;
  const lo = Math.min(...points.map((p) => p.score), 80);
  const x = (i: number) => (i / (points.length - 1)) * w;
  const y = (s: number) => h - ((s - lo) / (100 - lo || 1)) * (h - 4) - 2;
  const d = points
    .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`)
    .join(' ');
  const first = points[0];
  const last = points[points.length - 1];
  return (
    <figure className="quality-trend">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`Score from ${first.score.toFixed(1)}% on ${first.at.slice(0, 10)} to ${last.score.toFixed(1)}% on ${last.at.slice(0, 10)}, over ${points.length} runs`}
      >
        <line x1="0" x2={w} y1={y(100)} y2={y(100)} className="quality-trend-ref" />
        <path d={d} className="quality-trend-line" />
      </svg>
      <figcaption>
        {points.length} runs, {first.at.slice(0, 10)} to {last.at.slice(0, 10)}
      </figcaption>
    </figure>
  );
}
