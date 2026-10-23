/**
 * @bitbaum/chartkit/react — the charts every product draws.
 *
 *   import { LineChart, BarChart } from "@bitbaum/chartkit/react";
 *   import "@bitbaum/chartkit/styles.css";
 *
 * Every component renders on the server to SVG and HTML: no effect, no
 * measurement. The look follows the app's tokens through `--ck-*` variables
 * (see styles.css); the behaviour — a table behind every drawing, a label
 * that never clips, a point that is a link — is fixed here.
 */
export { LineChart } from "./LineChart.js";
export type { LineChartProps } from "./LineChart.js";
export { BarChart, ShareBars } from "./Bars.js";
export type { BarChartProps, BarRow, ShareBarsProps, ShareRow } from "./Bars.js";
export { Sparkline, Meter, StatTiles } from "./Small.js";
export type { SparklineProps, MeterProps, StatTile, StatTilesProps } from "./Small.js";
export { Timeline } from "./Timeline.js";
export type { TimelineProps, TimelineEvent } from "./Timeline.js";
export { ChartFigure, DataTable } from "./Figure.js";
export type { LinePoint, LineSeries, XValue } from "../index.js";
