import {
  formatNumber,
  formatX,
  isDate,
  linePath,
  numberTicks,
  timeTicks,
  valueScale,
  xExtent,
  xPercent,
  xPosition,
  yPercent,
  type LinePoint,
  type LineSeries,
  type Tick,
} from "../index.js";
import { ChartFigure } from "./Figure.js";

export interface LineChartProps {
  series: LineSeries[];
  /** "GW", "weeks", "USD m": shown with every value. */
  unit?: string;
  caption: string;
  /**
   * Where the value axis starts. `zero` always, `data` at the data's rounded
   * floor; left out, zero when the data sits near it and the floor otherwise.
   */
  yFrom?: "zero" | "data";
  /** Plot height in CSS px. The width is the container's. */
  height?: number;
}

/** Points with more than this many on one series draw smaller dots. */
const DENSE = 40;

/**
 * One or more series on shared axes. The line is an SVG stretched to the
 * plot (`preserveAspectRatio="none"`, non-scaling stroke), so it is drawn by
 * the browser at any width; the axis labels and the points are HTML laid
 * over it in per cent, so the text is in rem and never shrinks with the
 * plot. Every point is an anchor to the page its number came from, with its
 * value, period and note on hover and on keyboard focus.
 */
export function LineChart({ series, unit, caption, yFrom, height = 208 }: LineChartProps) {
  const scale = valueScale(
    series.flatMap((s) => s.points.map((p) => p.y)),
    yFrom ?? "auto",
  );
  const extent = xExtent(series);
  const dated = series.some((s) => s.points.some((p) => isDate(p.x)));
  const xTicks: Tick[] = dated
    ? timeTicks(extent[0], extent[1])
    : numberTicks(extent[0], extent[1]);
  const yTicks = scale.ticks.map((v) => ({ pos: yPercent(v, scale), label: formatNumber(v) }));
  const gutter = Math.max(...yTicks.map((t) => t.label.length)) + 1;
  const placed = series.map((s) =>
    s.points.map((p) => ({ point: p, x: xPercent(p.x, extent), y: yPercent(p.y, scale) })),
  );
  const unitText = unit ? ` ${unit}` : "";
  const xs = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort(
    (a, b) => xPosition(a) - xPosition(b),
  );
  const table = {
    head: ["Period", ...series.map((s) => (unit ? `${s.label} (${unit})` : s.label))],
    rows: xs.map((x) => [
      formatX(x),
      ...series.map((s) => {
        const p = s.points.find((q) => q.x === x);
        return p ? `${formatNumber(p.y)}${p.preliminary ? " (preliminary)" : ""}` : "";
      }),
    ]),
  };
  return (
    <ChartFigure
      kind="line"
      caption={caption}
      table={table}
      style={{ "--ck-gutter": `${gutter}ch`, "--ck-plot-height": `${height}px` }}
    >
      <div className="ck-line-plot">
        {yTicks.map((tick) => (
          <div
            key={tick.label}
            className="ck-line-grid"
            style={{ top: `${tick.pos}%` }}
            aria-hidden="true"
          >
            <span className="ck-line-tick">{tick.label}</span>
          </div>
        ))}
        {unit && (
          <span className="ck-line-unit" aria-hidden="true">
            {unit}
          </span>
        )}
        <svg
          className="ck-line-svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          {placed.map((pts, i) => (
            <path
              key={series[i].id}
              className="ck-line-path"
              data-series={(i % 6) + 1}
              d={linePath(pts)}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {placed.map((pts, i) =>
          pts.map(({ point, x, y }) => (
            <Point
              key={`${series[i].id}:${String(point.x)}`}
              point={point}
              x={x}
              y={y}
              index={(i % 6) + 1}
              dense={pts.length > DENSE}
              unit={unitText}
              label={series.length > 1 ? series[i].label : undefined}
            />
          )),
        )}
      </div>
      <div className="ck-line-axis" aria-hidden="true">
        {xTicks.map((tick) => (
          <span
            key={tick.label + tick.pos}
            className={`ck-line-xtick${tick.pos < 8 ? " ck-at-start" : tick.pos > 92 ? " ck-at-end" : ""}`}
            style={{ left: `${tick.pos}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>
      {series.length > 1 && (
        <ol className="ck-legend" aria-hidden="true">
          {series.map((s, i) => (
            <li key={s.id} className="ck-legend-item">
              <span className="ck-legend-swatch" data-series={(i % 6) + 1} />
              {s.label}
            </li>
          ))}
        </ol>
      )}
    </ChartFigure>
  );
}

function Point({
  point,
  x,
  y,
  index,
  dense,
  unit,
  label,
}: {
  point: LinePoint;
  x: number;
  y: number;
  index: number;
  dense: boolean;
  unit: string;
  label?: string;
}) {
  const period = `${formatX(point.x)}${point.preliminary ? " · preliminary" : ""}`;
  const text = `${formatNumber(point.y)}${unit}, ${period}${label ? ` — ${label}` : ""}${point.note ? `. ${point.note}` : ""}`;
  const className = `ck-pt${dense ? " ck-pt-dense" : ""}${x > 66 ? " ck-pt-end" : ""}`;
  const style = { left: `${x}%`, top: `${y}%` };
  const tip = (
    <span className="ck-tip" role="tooltip">
      <strong>
        {formatNumber(point.y)}
        {unit}
      </strong>
      <span>
        {label ? `${label} · ` : ""}
        {period}
      </span>
      {point.note && <span>{point.note}</span>}
    </span>
  );
  const out = point.href && /^https?:\/\//.test(point.href);
  return point.href ? (
    <a
      href={point.href}
      className={className}
      data-series={index}
      style={style}
      aria-label={text}
      {...(out ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {tip}
    </a>
  ) : (
    <span className={className} data-series={index} style={style} tabIndex={0} aria-label={text}>
      {tip}
    </span>
  );
}
