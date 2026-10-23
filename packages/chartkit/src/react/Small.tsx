import { linePath, valueScale, xExtent, xPercent, yPercent, type XValue } from "../index.js";
import { DataTable, MaybeLink } from "./Figure.js";

export interface SparklineProps {
  points: { x: XValue; y: number }[];
  /** What the line is: its accessible name. */
  label: string;
  /** CSS px. */
  width?: number;
  height?: number;
}

/**
 * The shape of a series in a line of text: no axes, the last point marked.
 * An SVG stretched to its box with a non-scaling stroke, so the line is the
 * same weight at every size.
 */
export function Sparkline({ points, label, width = 88, height = 28 }: SparklineProps) {
  if (points.length < 2) return null;
  const scale = valueScale(
    points.map((p) => p.y),
    "data",
  );
  const extent = xExtent([{ points }]);
  const placed = points.map((p) => ({ x: xPercent(p.x, extent), y: yPercent(p.y, scale) }));
  const end = placed[placed.length - 1];
  return (
    <svg
      className="ck-spark"
      viewBox="-3 -8 106 116"
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      <path d={linePath(placed)} vectorEffect="non-scaling-stroke" />
      <circle cx={end.x} cy={end.y} r="0.1" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export interface MeterProps {
  value: number;
  max: number;
  label: string;
  href?: string;
}

/**
 * A horizontal meter with the number beside it — Substrata's severity 12/12.
 * The number is the figure; the bar is how much of the scale it is.
 */
export function Meter({ value, max, label, href }: MeterProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <MaybeLink
      href={href}
      className="ck-chart ck-meter"
      title={`${label}: ${value} of ${max}`}
      style={{ "--ck-meter": `${pct}%` }}
    >
      <span className="ck-meter-value">{value}</span>
      <span
        className="ck-meter-track"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
      >
        <span className="ck-meter-fill" />
      </span>
    </MaybeLink>
  );
}

export interface StatTile {
  label: string;
  value: string | number;
  href?: string;
  note?: string;
}

export interface StatTilesProps {
  tiles: StatTile[];
  /** Names the strip for assistive tech and the table. */
  caption?: string;
}

/**
 * An even grid of figures — two across on a phone, up to four wider — one
 * shape per cell: the figure, then what it counts. A cell with an `href` is
 * a link to the rows behind the number.
 */
export function StatTiles({ tiles, caption = "Figures" }: StatTilesProps) {
  const n = Math.min(4, Math.max(1, tiles.length));
  return (
    <div className="ck-chart ck-chart-tiles" style={{ "--ck-n": n } as Record<string, number>}>
      <ul className="ck-tiles" aria-label={caption}>
        {tiles.map((t) => (
          <li key={t.label}>
            <MaybeLink href={t.href} className="ck-tile">
              <span className="ck-tile-value">{t.value}</span>
              <span className="ck-tile-label">{t.label}</span>
              {t.note && <span className="ck-tile-note">{t.note}</span>}
            </MaybeLink>
          </li>
        ))}
      </ul>
      <DataTable
        caption={caption}
        head={["Figure", "Value", "Note"]}
        rows={tiles.map((t) => [t.label, t.value, t.note ?? ""])}
      />
    </div>
  );
}
