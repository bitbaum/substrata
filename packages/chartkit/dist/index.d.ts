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
/**
 * Where an x value sits on the axis, as a number. A date is placed in UTC
 * ms: a year mid-year and a quarter mid-quarter — a position for drawing,
 * not a claim about the value. A number is itself. Unreadable → NaN.
 */
export declare function xPosition(x: XValue): number;
/** Whether an x value is a period rather than a number. */
export declare function isDate(x: XValue): boolean;
/** "2025", "Q2 2025", "Aug 2026", "3 Mar 2026"; a number as a number. */
export declare function formatX(x: XValue): string;
/** Values as the source gave them, grouped for reading; never rounded past three decimals. */
export declare function formatNumber(value: number): string;
/** A step of 1, 2 or 5 × 10ⁿ that splits the span into about `count` parts. */
export declare function niceStep(span: number, count: number): number;
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
export declare function valueScale(values: readonly number[], from?: "zero" | "data" | "auto", tickCount?: number): Scale;
/** Per cent from the top for a value on a scale. */
export declare function yPercent(value: number, scale: Scale): number;
/** The x extent of several series, as positions. */
export declare function xExtent(series: readonly {
    points: readonly {
        x: XValue;
    }[];
}[]): [number, number];
/** Per cent from the left for an x value on an extent. */
export declare function xPercent(x: XValue, [x0, x1]: [number, number]): number;
/** SVG path data through placed points, in a 0–100 box. */
export declare function linePath(placed: readonly Placed[]): string;
/**
 * Ticks along a time axis, at most `count` of them: on years when the span
 * is over three years, else on months, stepped so they stay apart.
 */
export declare function timeTicks(x0: number, x1: number, count?: number): Tick[];
/** Ticks for a numeric axis on round numbers. */
export declare function numberTicks(x0: number, x1: number, count?: number): Tick[];
/**
 * Shorten a label to `max` characters with an ellipsis, cutting at a word
 * where one falls in the last third. The full text travels in `title`.
 */
export declare function truncate(text: string, max: number): string;
/**
 * A lane per item so that no two spans in one lane overlap or come closer
 * than `gap`. A span is what an item occupies along the axis — a dot and
 * its label, whichever way the label faces. Items are taken in order of
 * their start; each goes in the first lane with room, so lanes are as few
 * as the spans allow and never fewer than the collisions demand.
 */
export declare function lanes(spans: readonly (readonly [number, number])[], gap?: number): number[];
export interface MonthTick extends Tick {
    /** Carries a label; the rest are marks between labels. */
    major: boolean;
}
/**
 * A mark at every month start between two instants, with a label on every
 * `step`-th so that at most `count` are labelled. A labelled January, and
 * the first label, name the year.
 */
export declare function monthTicks(x0: number, x1: number, count?: number): MonthTick[];
/** A share as "53%"; under one per cent, "<1%". */
export declare function formatShare(share: number): string;
//# sourceMappingURL=index.d.ts.map