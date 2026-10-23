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
export function findChartDefects(root = document, options = {}) {
    const slack = options.slack ?? 1;
    const found = [];
    const charts = (root instanceof Document ? root.body : root).querySelectorAll(".ck-chart");
    for (const chart of Array.from(charts)) {
        const frame = chart.getBoundingClientRect();
        const name = chart.querySelector(".ck-chart-caption")?.textContent?.trim() ||
            chart.getAttribute("title") ||
            chart.getAttribute("aria-label") ||
            chart.className;
        const texts = [];
        for (const el of Array.from(chart.querySelectorAll("*"))) {
            if (el.closest(".ck-sr"))
                continue;
            const own = Array.from(el.childNodes)
                .filter((n) => n.nodeType === Node.TEXT_NODE)
                .map((n) => n.nodeValue ?? "")
                .join("")
                .trim();
            if (!own)
                continue;
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0)
                continue;
            if (getComputedStyle(el).visibility === "hidden")
                continue;
            texts.push({ el, rect, text: own });
        }
        for (const t of texts) {
            if (t.rect.left < frame.left - slack ||
                t.rect.right > frame.right + slack ||
                t.rect.top < frame.top - slack ||
                t.rect.bottom > frame.bottom + slack) {
                found.push(`${name}: "${t.text}" leaves the figure`);
            }
        }
        for (let i = 0; i < texts.length; i++) {
            for (let j = i + 1; j < texts.length; j++) {
                const a = texts[i];
                const b = texts[j];
                if (a.el.contains(b.el) || b.el.contains(a.el))
                    continue;
                const overlapX = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
                const overlapY = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
                if (overlapX > slack && overlapY > slack) {
                    found.push(`${name}: "${a.text}" overlaps "${b.text}"`);
                }
            }
        }
    }
    return found;
}
/** `findChartDefects` as source text, for `page.evaluate`. */
export const CHART_DEFECTS_SOURCE = findChartDefects.toString();
//# sourceMappingURL=audit.js.map