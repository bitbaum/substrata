import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { formatNumber, formatX, isDate, linePath, numberTicks, timeTicks, valueScale, xExtent, xPercent, xPosition, yPercent, } from "../index.js";
import { ChartFigure } from "./Figure.js";
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
export function LineChart({ series, unit, caption, yFrom, height = 208 }) {
    const scale = valueScale(series.flatMap((s) => s.points.map((p) => p.y)), yFrom ?? "auto");
    const extent = xExtent(series);
    const dated = series.some((s) => s.points.some((p) => isDate(p.x)));
    const xTicks = dated
        ? timeTicks(extent[0], extent[1])
        : numberTicks(extent[0], extent[1]);
    const yTicks = scale.ticks.map((v) => ({ pos: yPercent(v, scale), label: formatNumber(v) }));
    const gutter = Math.max(...yTicks.map((t) => t.label.length)) + 1;
    const placed = series.map((s) => s.points.map((p) => ({ point: p, x: xPercent(p.x, extent), y: yPercent(p.y, scale) })));
    const unitText = unit ? ` ${unit}` : "";
    const xs = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => xPosition(a) - xPosition(b));
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
    return (_jsxs(ChartFigure, { kind: "line", caption: caption, table: table, style: { "--ck-gutter": `${gutter}ch`, "--ck-plot-height": `${height}px` }, children: [_jsxs("div", { className: "ck-line-plot", children: [yTicks.map((tick) => (_jsx("div", { className: "ck-line-grid", style: { top: `${tick.pos}%` }, "aria-hidden": "true", children: _jsx("span", { className: "ck-line-tick", children: tick.label }) }, tick.label))), unit && (_jsx("span", { className: "ck-line-unit", "aria-hidden": "true", children: unit })), _jsx("svg", { className: "ck-line-svg", viewBox: "0 0 100 100", preserveAspectRatio: "none", "aria-hidden": "true", focusable: "false", children: placed.map((pts, i) => (_jsx("path", { className: "ck-line-path", "data-series": (i % 6) + 1, d: linePath(pts), vectorEffect: "non-scaling-stroke" }, series[i].id))) }), placed.map((pts, i) => pts.map(({ point, x, y }) => (_jsx(Point, { point: point, x: x, y: y, index: (i % 6) + 1, dense: pts.length > DENSE, unit: unitText, label: series.length > 1 ? series[i].label : undefined }, `${series[i].id}:${String(point.x)}`))))] }), _jsx("div", { className: "ck-line-axis", "aria-hidden": "true", children: xTicks.map((tick) => (_jsx("span", { className: `ck-line-xtick${tick.pos < 8 ? " ck-at-start" : tick.pos > 92 ? " ck-at-end" : ""}`, style: { left: `${tick.pos}%` }, children: tick.label }, tick.label + tick.pos))) }), series.length > 1 && (_jsx("ol", { className: "ck-legend", "aria-hidden": "true", children: series.map((s, i) => (_jsxs("li", { className: "ck-legend-item", children: [_jsx("span", { className: "ck-legend-swatch", "data-series": (i % 6) + 1 }), s.label] }, s.id))) }))] }));
}
function Point({ point, x, y, index, dense, unit, label, }) {
    const period = `${formatX(point.x)}${point.preliminary ? " · preliminary" : ""}`;
    const text = `${formatNumber(point.y)}${unit}, ${period}${label ? ` — ${label}` : ""}${point.note ? `. ${point.note}` : ""}`;
    const className = `ck-pt${dense ? " ck-pt-dense" : ""}${x > 66 ? " ck-pt-end" : ""}`;
    const style = { left: `${x}%`, top: `${y}%` };
    const tip = (_jsxs("span", { className: "ck-tip", role: "tooltip", children: [_jsxs("strong", { children: [formatNumber(point.y), unit] }), _jsxs("span", { children: [label ? `${label} · ` : "", period] }), point.note && _jsx("span", { children: point.note })] }));
    const out = point.href && /^https?:\/\//.test(point.href);
    return point.href ? (_jsx("a", { href: point.href, className: className, "data-series": index, style: style, "aria-label": text, ...(out ? { target: "_blank", rel: "noopener noreferrer" } : {}), children: tip })) : (_jsx("span", { className: className, "data-series": index, style: style, tabIndex: 0, "aria-label": text, children: tip }));
}
//# sourceMappingURL=LineChart.js.map