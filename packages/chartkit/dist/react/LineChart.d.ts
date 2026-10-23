import { type LineSeries } from "../index.js";
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
/**
 * One or more series on shared axes. The line is an SVG stretched to the
 * plot (`preserveAspectRatio="none"`, non-scaling stroke), so it is drawn by
 * the browser at any width; the axis labels and the points are HTML laid
 * over it in per cent, so the text is in rem and never shrinks with the
 * plot. Every point is an anchor to the page its number came from, with its
 * value, period and note on hover and on keyboard focus.
 */
export declare function LineChart({ series, unit, caption, yFrom, height }: LineChartProps): import("react").JSX.Element;
//# sourceMappingURL=LineChart.d.ts.map