/**
 * @bitbaum/chartkit — the arithmetic behind every chart, as pure functions.
 *
 * Nothing here touches the DOM. Where a point sits (in per cent of the plot),
 * which round numbers the axis names, which month ticks a timeline gets,
 * which lane an event goes in when two collide, how a label is shortened:
 * each is a function of the data alone, so it runs on the server, is tested
 * with `node --test`, and draws the same at 320px and at 1440px because the
 * browser only stretches what was computed once.
 */

/** An x value: an ISO period (YYYY, YYYY-MM, YYYY-MM-DD, YYYY-Qn) or a number. */
export type XValue = string | number;

export interface LinePoint {
  x: XValue;
  y: number;
  /** The page the number came from. Every point is a link when it has one. */
  href?: string;
  note?: string;
  /** The publisher marks the value preliminary. */
  preliminary?: boolean;
}

export interface LineSeries {
  id: string;
  label: string;
  points: LinePoint[];
}

export interface Placed {
  /** 0–100 from the left. */
  x: number;
  /** 0–100 from the top. */
  y: number;
}

export interface Tick {
  /** 0–100 along the axis. */
  pos: number;
  label: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Where an x value sits on the axis, as a number. A date is placed in UTC
 * ms: a year mid-year and a quarter mid-quarter — a position for drawing,
 * not a claim about the value. A number is itself. Unreadable → NaN.
 */
export function xPosition(x: XValue): number {
  if (typeof x === "number") return x;
  const q = x.match(/^(\d{4})-Q([1-4])$/);
  if (q) return Date.UTC(Number(q[1]), (Number(q[2]) - 1) * 3 + 1, 15);
  const m = x.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!m) return NaN;
  if (!m[2]) return Date.UTC(Number(m[1]), 6, 1);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, m[3] ? Number(m[3]) : 15);
}

/** Whether an x value is a period rather than a number. */
export function isDate(x: XValue): boolean {
  return typeof x === "string";
}

/** "2025", "Q2 2025", "Aug 2026", "3 Mar 2026"; a number as a number. */
export function formatX(x: XValue): string {
  if (typeof x === "number") return formatNumber(x);
  const q = x.match(/^(\d{4})-Q([1-4])$/);
  if (q) return `Q${q[2]} ${q[1]}`;
  const m = x.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!m) return x;
  if (!m[2]) return m[1];
  const month = MONTHS[Number(m[2]) - 1];
  return m[3] ? `${Number(m[3])} ${month} ${m[1]}` : `${month} ${m[1]}`;
}

/** Values as the source gave them, grouped for reading; never rounded past three decimals. */
export function formatNumber(value: number): string {
  return value.toLocaleString("en", { maximumFractionDigits: 3 });
}

/** A step of 1, 2 or 5 × 10ⁿ that splits the span into about `count` parts. */
export function niceStep(span: number, count: number): number {
  if (!(span > 0)) return 1;
  const raw = span / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}

export interface Scale {
  min: number;
  max: number;
  ticks: number[];
}

/**
 * A value axis on round numbers. `from: "zero"` starts at zero; `"data"` at
 * the rounded floor of the data; `"auto"` (the default) starts at zero when
 * the data sits near it, so a small value is not drawn as a large one.
 */
export function valueScale(
  values: readonly number[],
  from: "zero" | "data" | "auto" = "auto",
  tickCount = 3,
): Scale {
  const finite = values.filter((v) => Number.isFinite(v));
  let lo = finite.length ? Math.min(...finite) : 0;
  let hi = finite.length ? Math.max(...finite) : 1;
  if (from === "zero") lo = Math.min(lo, 0);
  if (lo === hi) {
    // One value, or a flat line: give it room rather than dividing by zero.
    const pad = Math.abs(lo) * 0.1 || 1;
    lo -= pad;
    hi += pad;
  }
  const step = niceStep(hi - lo, tickCount);
  const nearZero = lo >= 0 && lo < (hi - lo) * 0.5;
  const min =
    from === "zero" || (from === "auto" && nearZero)
      ? Math.min(0, lo)
      : Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
  return { min, max, ticks };
}

/** Per cent from the top for a value on a scale. */
export function yPercent(value: number, scale: Scale): number {
  return scale.max === scale.min ? 50 : ((scale.max - value) / (scale.max - scale.min)) * 100;
}

/** The x extent of several series, as positions. */
export function xExtent(series: readonly { points: readonly { x: XValue }[] }[]): [number, number] {
  const xs = series.flatMap((s) => s.points.map((p) => xPosition(p.x))).filter(Number.isFinite);
  if (xs.length === 0) return [0, 1];
  return [Math.min(...xs), Math.max(...xs)];
}

/** Per cent from the left for an x value on an extent. */
export function xPercent(x: XValue, [x0, x1]: [number, number]): number {
  const v = xPosition(x);
  return x1 === x0 ? 50 : ((v - x0) / (x1 - x0)) * 100;
}

/** SVG path data through placed points, in a 0–100 box. */
export function linePath(placed: readonly Placed[]): string {
  return placed
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}

/**
 * Ticks along a time axis, at most `count` of them: on years when the span
 * is over three years, else on months, stepped so they stay apart.
 */
export function timeTicks(x0: number, x1: number, count = 5): Tick[] {
  if (!(x1 > x0)) return [{ pos: 50, label: formatMs(x0, "month") }];
  const span = x1 - x0;
  const year = 365.25 * 86_400_000;
  const ticks: Tick[] = [];
  const pos = (t: number) => ((t - x0) / span) * 100;
  if (span > 3 * year) {
    const y0 = new Date(x0).getUTCFullYear();
    const y1 = new Date(x1).getUTCFullYear();
    const step = Math.max(1, Math.ceil((y1 - y0 + 1) / count));
    for (let y = y0 + 1; y <= y1; y += step) {
      const t = Date.UTC(y, 0, 1);
      if (t >= x0 && t <= x1) ticks.push({ pos: pos(t), label: String(y) });
    }
  } else {
    const d0 = new Date(x0);
    const months = Math.round(span / (year / 12)) + 1;
    const step = Math.max(1, Math.ceil(months / count));
    let y = d0.getUTCFullYear();
    let m = d0.getUTCMonth() + 1;
    for (let i = 0; i < months + 1; i++) {
      if (m > 11) {
        m = 0;
        y++;
      }
      const t = Date.UTC(y, m, 1);
      if (t > x1) break;
      if (t >= x0 && (m % step === 0 || step === 1)) {
        ticks.push({
          pos: pos(t),
          label: m === 0 || ticks.length === 0 ? `${MONTHS[m]} ${y}` : MONTHS[m],
        });
      }
      m++;
    }
  }
  return ticks;
}

function formatMs(t: number, unit: "year" | "month"): string {
  const d = new Date(t);
  return unit === "year"
    ? String(d.getUTCFullYear())
    : `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Ticks for a numeric axis on round numbers. */
export function numberTicks(x0: number, x1: number, count = 5): Tick[] {
  const scale = valueScale([x0, x1], "data", count);
  return scale.ticks
    .filter((v) => v >= x0 && v <= x1)
    .map((v) => ({ pos: ((v - x0) / (x1 - x0 || 1)) * 100, label: formatNumber(v) }));
}

/**
 * Shorten a label to `max` characters with an ellipsis, cutting at a word
 * where one falls in the last third. The full text travels in `title`.
 */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max - 1);
  const space = head.lastIndexOf(" ");
  return `${space > (max * 2) / 3 ? head.slice(0, space) : head}…`;
}

/**
 * A lane per item so that no two spans in one lane overlap or come closer
 * than `gap`. A span is what an item occupies along the axis — a dot and
 * its label, whichever way the label faces. Items are taken in order of
 * their start; each goes in the first lane with room, so lanes are as few
 * as the spans allow and never fewer than the collisions demand.
 */
export function lanes(spans: readonly (readonly [number, number])[], gap = 0): number[] {
  const order = spans.map((s, i) => [s, i] as const).sort((a, b) => a[0][0] - b[0][0]);
  const taken: [number, number][][] = [];
  const lane = new Array<number>(spans.length).fill(0);
  for (const [[start, end], i] of order) {
    let l = taken.findIndex((spans) => spans.every(([a, b]) => end + gap <= a || start >= b + gap));
    if (l < 0) {
      l = taken.length;
      taken.push([]);
    }
    taken[l].push([start, end]);
    lane[i] = l;
  }
  return lane;
}

export interface MonthTick extends Tick {
  /** Carries a label; the rest are marks between labels. */
  major: boolean;
}

/**
 * A mark at every month start between two instants, with a label on every
 * `step`-th so that at most `count` are labelled. A labelled January, and
 * the first label, name the year.
 */
export function monthTicks(x0: number, x1: number, count = 6): MonthTick[] {
  if (!(x1 > x0)) return [];
  const d0 = new Date(x0);
  let y = d0.getUTCFullYear();
  let m = d0.getUTCMonth();
  const starts: number[] = [];
  for (;;) {
    const t = Date.UTC(y, m, 1);
    if (t > x1) break;
    if (t >= x0) starts.push(t);
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  const step = Math.max(1, Math.ceil(starts.length / count));
  let labelled = 0;
  return starts.map((t, i) => {
    const major = i % step === 0;
    const d = new Date(t);
    const label = major
      ? d.getUTCMonth() === 0 || labelled++ === 0
        ? `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
        : MONTHS[d.getUTCMonth()]
      : "";
    return { pos: ((t - x0) / (x1 - x0)) * 100, label, major };
  });
}

/** A share as "53%"; under one per cent, "<1%". */
export function formatShare(share: number): string {
  const pct = share * 100;
  if (pct > 0 && pct < 1) return "<1%";
  return `${pct >= 10 ? pct.toFixed(0) : pct.toFixed(1).replace(/\.0$/, "")}%`;
}
