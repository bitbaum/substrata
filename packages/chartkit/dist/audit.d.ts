/**
 * Layout audits for a real browser — the part no unit test can see.
 *
 * Import this from a Playwright script, never from app code. `findChartDefects`
 * runs INSIDE the page: it is self-contained on purpose (no imports, no
 * closures), so its source can be handed to `page.evaluate`:
 *
 *   import { CHART_DEFECTS_SOURCE } from "@bitbaum/chartkit/audit";
 *   const defects = await page.evaluate(`(${CHART_DEFECTS_SOURCE})(document.body)`);
 *   if (defects.length) throw new Error(`chart text clipped or overlapping: ${defects}`);
 *
 * Why it exists: a chart's labels are laid out by the browser with the real
 * font at the real width, and a tick that runs past the figure's edge at
 * 320px, or two event labels printed over each other, is invisible to the
 * code that drew them. Only measuring the boxes finds it — the same reason
 * chatkit's `findBrokenWords` exists.
 */
/**
 * Every piece of chart text under `root` whose box leaves its chart, or
 * overlaps another piece of text in the same chart. A chart is an element
 * with the class `ck-chart`; a piece of text is an element holding a text
 * node of its own. Visually hidden tables (`ck-sr`) and anything with no
 * box (a tooltip that is not showing) are skipped; so is a pair where one
 * element contains the other. Each defect is one line naming the chart's
 * caption, the text and what is wrong with it.
 */
export declare function findChartDefects(root?: ParentNode, options?: {
    slack?: number;
}): string[];
/** `findChartDefects` as source text, for `page.evaluate`. */
export declare const CHART_DEFECTS_SOURCE: string;
//# sourceMappingURL=audit.d.ts.map