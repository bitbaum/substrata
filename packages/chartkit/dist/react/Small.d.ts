import { type XValue } from "../index.js";
export interface SparklineProps {
    points: {
        x: XValue;
        y: number;
    }[];
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
export declare function Sparkline({ points, label, width, height }: SparklineProps): import("react").JSX.Element | null;
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
export declare function Meter({ value, max, label, href }: MeterProps): import("react").JSX.Element;
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
export declare function StatTiles({ tiles, caption }: StatTilesProps): import("react").JSX.Element;
//# sourceMappingURL=Small.d.ts.map