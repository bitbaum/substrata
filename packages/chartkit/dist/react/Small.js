import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { linePath, valueScale, xExtent, xPercent, yPercent } from "../index.js";
import { DataTable, MaybeLink } from "./Figure.js";
/**
 * The shape of a series in a line of text: no axes, the last point marked.
 * An SVG stretched to its box with a non-scaling stroke, so the line is the
 * same weight at every size.
 */
export function Sparkline({ points, label, width = 88, height = 28 }) {
    if (points.length < 2)
        return null;
    const scale = valueScale(points.map((p) => p.y), "data");
    const extent = xExtent([{ points }]);
    const placed = points.map((p) => ({ x: xPercent(p.x, extent), y: yPercent(p.y, scale) }));
    const end = placed[placed.length - 1];
    return (_jsxs("svg", { className: "ck-spark", viewBox: "-3 -8 106 116", preserveAspectRatio: "none", role: "img", "aria-label": label, style: { width: `${width}px`, height: `${height}px` }, children: [_jsx("path", { d: linePath(placed), vectorEffect: "non-scaling-stroke" }), _jsx("circle", { cx: end.x, cy: end.y, r: "0.1", vectorEffect: "non-scaling-stroke" })] }));
}
/**
 * A horizontal meter with the number beside it — Substrata's severity 12/12.
 * The number is the figure; the bar is how much of the scale it is.
 */
export function Meter({ value, max, label, href }) {
    const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
    return (_jsxs(MaybeLink, { href: href, className: "ck-chart ck-meter", title: `${label}: ${value} of ${max}`, style: { "--ck-meter": `${pct}%` }, children: [_jsx("span", { className: "ck-meter-value", children: value }), _jsx("span", { className: "ck-meter-track", role: "meter", "aria-valuemin": 0, "aria-valuemax": max, "aria-valuenow": value, "aria-label": label, children: _jsx("span", { className: "ck-meter-fill" }) })] }));
}
/**
 * An even grid of figures — two across on a phone, up to four wider — one
 * shape per cell: the figure, then what it counts. A cell with an `href` is
 * a link to the rows behind the number.
 */
export function StatTiles({ tiles, caption = "Figures" }) {
    const n = Math.min(4, Math.max(1, tiles.length));
    return (_jsxs("div", { className: "ck-chart ck-chart-tiles", style: { "--ck-n": n }, children: [_jsx("ul", { className: "ck-tiles", "aria-label": caption, children: tiles.map((t) => (_jsx("li", { children: _jsxs(MaybeLink, { href: t.href, className: "ck-tile", children: [_jsx("span", { className: "ck-tile-value", children: t.value }), _jsx("span", { className: "ck-tile-label", children: t.label }), t.note && _jsx("span", { className: "ck-tile-note", children: t.note })] }) }, t.label))) }), _jsx(DataTable, { caption: caption, head: ["Figure", "Value", "Note"], rows: tiles.map((t) => [t.label, t.value, t.note ?? ""]) })] }));
}
//# sourceMappingURL=Small.js.map