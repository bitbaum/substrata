import { formatX, lanes, monthTicks, xPosition } from "../index.js";
import { ChartFigure, MaybeLink } from "./Figure.js";

export interface TimelineEvent {
  /** ISO date. */
  date: string;
  label: string;
  href?: string;
  /** Which way it moved things: drawn in the up/down colours. */
  tone?: "up" | "down" | "neutral";
  /** Free text carried as `data-kind` for an app's own styling. */
  kind?: string;
}

export interface TimelineProps {
  events: TimelineEvent[];
  caption: string;
  /** ISO dates. Left out, the axis runs from the month of the first event to the month after the last. */
  from?: string;
  to?: string;
}

/**
 * The width a label may take, per cent of the axis: an event occupies its
 * dot plus this much to the right, or to the left when it is nearer the
 * end than that. At 320px it is ~85px, a few words and an ellipsis — the
 * full text is in `title` and in the table. Two events whose spans would
 * touch go in separate lanes.
 */
const LABEL = 30;

/**
 * Events on a horizontal date axis with month ticks. Each event is an anchor
 * — a dot on its date and its label beside it; events that would collide
 * stack into a second lane rather than overprint. The label sits to the
 * right in the left part of the axis and to the left near its end, and is
 * never wider than the room to its neighbour.
 */
export function Timeline({ events, caption, from, to }: TimelineProps) {
  const sorted = [...events].sort((a, b) => xPosition(a.date) - xPosition(b.date));
  const times = sorted.map((e) => xPosition(e.date));
  const first = times[0] ?? Date.now();
  const last = times[times.length - 1] ?? first;
  const x0 = from ? xPosition(from) : monthStart(first, 0);
  const x1 = to ? xPosition(to) : monthStart(last, 1);
  const span = x1 - x0 || 1;
  const positions = times.map((t) => ((t - x0) / span) * 100);
  const facesRight = positions.map((p) => p <= 100 - LABEL);
  const spans = positions.map((p, i) =>
    facesRight[i] ? ([p, p + LABEL] as const) : ([p - LABEL, p] as const),
  );
  const lane = lanes(spans, 1);
  const laneCount = Math.max(1, ...lane.map((l) => l + 1));
  const ticks = monthTicks(x0, x1);
  let labelled = 0;
  const table = {
    head: ["Date", "Event", "Effect"],
    rows: sorted.map((e) => [formatX(e.date), e.label, e.tone ?? ""]),
  };
  return (
    <ChartFigure kind="timeline" caption={caption} table={table}>
      <div className="ck-tl" style={{ "--ck-lanes": laneCount } as Record<string, number>}>
        {Array.from({ length: laneCount }, (_, l) => (
          <div key={l} className="ck-tl-lane">
            {sorted.map((e, i) => {
              if (lane[i] !== l) return null;
              const pos = positions[i];
              const right = facesRight[i];
              // The lane guarantees LABEL; the label may take all the room
              // to its neighbour in the lane (or the edge) when there is more.
              const mates = spans.filter((_, j) => j !== i && lane[j] === l);
              const room = right
                ? Math.min(100, ...mates.filter(([a]) => a >= pos).map(([a]) => a)) - pos
                : pos - Math.max(0, ...mates.filter(([, b]) => b <= pos).map(([, b]) => b));
              const text = `${formatX(e.date)}: ${e.label}`;
              return (
                <MaybeLink
                  key={e.date + e.label}
                  href={e.href}
                  className={`ck-tl-event${right ? "" : " ck-tl-left"}`}
                  title={text}
                  style={{ left: `${pos}%`, "--ck-room": `${room - 2}%` }}
                >
                  <span className="ck-tl-dot" data-tone={e.tone ?? "neutral"} data-kind={e.kind} />
                  <span className="ck-tl-label">{e.label}</span>
                </MaybeLink>
              );
            })}
          </div>
        ))}
        <div className="ck-tl-axis" aria-hidden="true">
          {ticks.map((t) => (
            <span
              key={t.pos}
              className={`ck-tl-tick${t.major ? " ck-tl-major" : ""}${t.pos < 8 ? " ck-at-start" : t.pos > 92 ? " ck-at-end" : ""}`}
              data-alt={t.major && labelled++ % 2 === 1 ? "" : undefined}
              style={{ left: `${t.pos}%` }}
            >
              {t.label && <span className="ck-tl-month">{t.label}</span>}
            </span>
          ))}
        </div>
      </div>
    </ChartFigure>
  );
}

/** The first instant of the month `offset` months after the one holding `t`. */
function monthStart(t: number, offset: number): number {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1);
}
