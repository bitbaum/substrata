import React from 'react';

import { periodTime } from '@/lib/series';

// ---------------------------------------------------------------------------
// LineChart — dated values, one line per series, every point a link.
// ---------------------------------------------------------------------------

export interface LinePoint {
  /** A period (YYYY, YYYY-Qn, YYYY-MM, YYYY-MM-DD) or a time in ms. */
  x: string | number;
  y: number;
  href?: string;
  note?: string;
}

export interface LineSeries {
  id: string;
  label: string;
  points: LinePoint[];
}

const timeOf = (x: string | number) => (typeof x === 'number' ? x : periodTime(x));

export function formatNumber(value: number): string {
  if (Math.abs(value) >= 1000) return value.toLocaleString('en-GB', { maximumFractionDigits: 0 });
  return value.toLocaleString('en-GB', { maximumFractionDigits: 2 });
}

/** A step of 1, 2 or 5 × 10ⁿ that splits the span into about `count` parts. */
function niceStep(span: number, count: number): number {
  if (!(span > 0)) return 1;
  const raw = span / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}

export function LineChart({
  series,
  unit,
  caption,
}: {
  series: LineSeries[];
  unit?: string;
  caption?: React.ReactNode;
}) {
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return null;
  const values = all.map((p) => p.y);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    const pad = Math.abs(lo) * 0.1 || 1;
    lo -= pad;
    hi += pad;
  }
  const step = niceStep(hi - lo, 3);
  const min = lo >= 0 && lo < (hi - lo) * 0.5 ? 0 : Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const times = all.map((p) => timeOf(p.x));
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const px = (x: string | number) => (t1 === t0 ? 50 : ((timeOf(x) - t0) / (t1 - t0)) * 100);
  const py = (v: number) => ((max - v) / (max - min)) * 100;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
  const first = all.reduce((a, b) => (timeOf(a.x) <= timeOf(b.x) ? a : b));
  const last = all.reduce((a, b) => (timeOf(a.x) >= timeOf(b.x) ? a : b));
  const label = (x: string | number) =>
    typeof x === 'number' ? new Date(x).toISOString().slice(0, 10) : x;
  return (
    <figure className="ck-line">
      <div className="ck-line-plot">
        {ticks.map((v) => (
          <div key={v} className="ck-line-grid" style={{ top: `${py(v)}%` }}>
            <span className="ck-line-tick">{formatNumber(v)}</span>
          </div>
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden focusable="false">
          {series.map((s, i) => {
            const sorted = [...s.points].sort((a, b) => timeOf(a.x) - timeOf(b.x));
            return (
              <path
                key={s.id}
                className={`ck-line-path is-${i % 4}`}
                vectorEffect="non-scaling-stroke"
                d={sorted
                  .map(
                    (p, j) => `${j === 0 ? 'M' : 'L'}${px(p.x).toFixed(2)} ${py(p.y).toFixed(2)}`,
                  )
                  .join(' ')}
              />
            );
          })}
        </svg>
        {series.map((s, i) =>
          s.points.map((p) => {
            const tip = `${formatNumber(p.y)}${unit ? ` ${unit}` : ''} · ${label(p.x)}${series.length > 1 ? ` · ${s.label}` : ''}${p.note ? ` · ${p.note}` : ''}`;
            const style = { left: `${px(p.x)}%`, top: `${py(p.y)}%` };
            const cls = `ck-line-dot is-${i % 4}${px(p.x) > 66 ? ' is-end' : ''}`;
            return p.href ? (
              <a
                key={`${s.id}:${p.x}`}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cls}
                style={style}
                aria-label={tip}
              >
                <span className="ck-line-tip" role="tooltip">
                  {tip} ↗
                </span>
              </a>
            ) : (
              <span key={`${s.id}:${p.x}`} className={cls} style={style} title={tip} />
            );
          }),
        )}
      </div>
      <div className="ck-line-axis" aria-hidden>
        <span>{label(first.x)}</span>
        {all.length > 1 && <span>{label(last.x)}</span>}
      </div>
      {series.length > 1 && (
        <ul className="ck-legend">
          {series.map((s, i) => (
            <li key={s.id} className={`is-${i % 4}`}>
              {s.label}
            </li>
          ))}
        </ul>
      )}
      {caption && <figcaption className="ck-caption">{caption}</figcaption>}
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Sparkline — the shape of a series in a line of text.
// ---------------------------------------------------------------------------

export function Sparkline({ points, label }: { points: LinePoint[]; label?: string }) {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => timeOf(a.x) - timeOf(b.x));
  const t0 = timeOf(sorted[0].x);
  const t1 = timeOf(sorted[sorted.length - 1].x);
  const lo = Math.min(...sorted.map((p) => p.y));
  const hi = Math.max(...sorted.map((p) => p.y));
  const px = (p: LinePoint) => (t1 === t0 ? 50 : ((timeOf(p.x) - t0) / (t1 - t0)) * 100);
  const py = (p: LinePoint) => (hi === lo ? 50 : ((hi - p.y) / (hi - lo)) * 100);
  const end = sorted[sorted.length - 1];
  return (
    <svg
      className="ck-spark"
      viewBox="-3 -8 106 116"
      preserveAspectRatio="none"
      role="img"
      aria-label={label ?? `Trend over ${points.length} points`}
    >
      <path
        vectorEffect="non-scaling-stroke"
        d={sorted
          .map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p).toFixed(2)} ${py(p).toFixed(2)}`)
          .join(' ')}
      />
      <circle cx={px(end)} cy={py(end)} r="0.1" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
