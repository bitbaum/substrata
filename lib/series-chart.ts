/**
 * Geometry for a series chart, as pure functions: where each point sits, in
 * per cent of the plot, and which round numbers the axis names.
 *
 * Positions are percentages so the chart is drawn by the browser at any width
 * — the line in an SVG stretched to the plot, the points as real links laid
 * over it — rather than as a fixed picture whose labels shrink to nothing on
 * a phone.
 */
import { periodTime, type SeriesPoint } from './series';

export interface Placed {
  point: SeriesPoint;
  /** 0–100 from the left. */
  x: number;
  /** 0–100 from the top. */
  y: number;
}

export interface Geometry {
  placed: Placed[];
  ticks: { value: number; y: number }[];
  min: number;
  max: number;
}

/** A step of 1, 2 or 5 × 10ⁿ that splits the span into about `count` parts. */
export function niceStep(span: number, count: number): number {
  if (!(span > 0)) return 1;
  const raw = span / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}

export function geometry(points: readonly SeriesPoint[], tickCount = 3): Geometry {
  const values = points.map((p) => p.value);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    // One value, or a flat line: give it room rather than dividing by zero.
    const pad = Math.abs(lo) * 0.1 || 1;
    lo -= pad;
    hi += pad;
  }
  const step = niceStep(hi - lo, tickCount);
  // A baseline of zero when the data sits near it, so small values are not
  // drawn as large ones; otherwise the rounded range of the data.
  const min = lo >= 0 && lo < (hi - lo) * 0.5 ? 0 : Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const times = points.map((p) => periodTime(p.date));
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const y = (v: number) => (max === min ? 50 : ((max - v) / (max - min)) * 100);
  const placed = points.map((point, i) => ({
    point,
    x: t1 === t0 ? 50 : ((times[i] - t0) / (t1 - t0)) * 100,
    y: y(point.value),
  }));
  const ticks: Geometry['ticks'] = [];
  for (let v = min; v <= max + step / 2; v += step) {
    const value = Number(v.toPrecision(12));
    ticks.push({ value, y: y(value) });
  }
  return { placed, ticks, min, max };
}

/** SVG path data for the line through placed points, in a 0–100 box. */
export function linePath(placed: readonly Placed[]): string {
  return placed
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
}
