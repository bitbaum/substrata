/**
 * The chart vocabulary company profiles draw with — the React API of
 * `@bitbaum/chartkit/react`, written here against its contract until that
 * package lands (branch claude/chat-design-products-n133h8-chartkit, folder
 * packages/chartkit). When it does, this file goes and every importer's
 * `@/components/charts` becomes `@bitbaum/chartkit/react`; the props do not
 * change. Styles: app/styles/charts.css, tokens only.
 *
 * Every chart here is server-rendered HTML and SVG stretched to its box, so
 * it reads at 320px and prints. Nothing is reachable only by pointing: a
 * value is in the markup, a point is a link to its source, a tile is a link
 * to the rows it counts.
 */

export { StatTiles, Meter, type StatTile } from './tiles';
export { ShareBars, BarChart, type ShareRow, type BarRow } from './shares';
export { LineChart, Sparkline, type LinePoint, type LineSeries } from './line';
export { Timeline, type TimelineEvent, type TimelineTone } from './timeline';
