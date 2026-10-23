import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { formatNumber, formatShare, truncate } from "../index.js";
import { ChartFigure, MaybeLink } from "./Figure.js";
/** Labels longer than this get an ellipsis and carry the full text in `title`. */
const LABEL_MAX = 28;
/**
 * Horizontal ranked bars: label left, bar, value right. Rows are ranked —
 * largest first, no number last — whatever order they arrive in; a chart
 * called ranked that trusts its caller's order is sometimes not ranked.
 */
export function BarChart({ rows, unit, caption, highlight }) {
    const ranked = [...rows].sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
    const max = Math.max(0, ...ranked.map((r) => r.value ?? 0));
    const table = {
        head: ["Row", unit ? `Value (${unit})` : "Value", "Share", "Note"],
        rows: ranked.map((r) => [
            r.label,
            r.value === null ? "—" : `${formatNumber(r.value)}${r.estimated ? " (estimated)" : ""}`,
            r.share === undefined ? "" : formatShare(r.share),
            r.note ?? "",
        ]),
    };
    return (_jsx(ChartFigure, { kind: "bars", caption: caption, table: table, children: _jsx("ol", { className: "ck-bars", "aria-hidden": "true", children: ranked.map((r) => (_jsxs("li", { className: `ck-bar-row${r.label === highlight ? " ck-bar-row-hi" : ""}`, children: [_jsx(MaybeLink, { href: r.href, className: "ck-bar-label", title: r.note ? `${r.label}: ${r.note}` : r.label, children: truncate(r.label, LABEL_MAX) }), _jsx("span", { className: "ck-bar-track", children: r.value !== null && max > 0 && (_jsx("span", { className: "ck-bar-fill", style: { width: `${(r.value / max) * 100}%` } })) }), _jsxs("span", { className: "ck-bar-value", children: [r.value === null ? (_jsx("span", { className: "ck-bar-none", children: "\u2014" })) : (_jsxs(_Fragment, { children: [r.estimated && (_jsx("span", { className: "ck-bar-est", title: "Estimated", children: "\u2248" })), formatNumber(r.value)] })), r.share !== undefined && (_jsx("span", { className: "ck-bar-share", children: formatShare(r.share) }))] })] }, r.label))) }) }));
}
/**
 * One 100% stacked bar with a legend row under it. The largest segment
 * carries its label inside when the segment is wide enough for it (a
 * container query, so the same markup decides at every width); every
 * segment is named in the legend.
 */
export function ShareBars({ rows, caption, other }) {
    const ordered = [...rows].sort((a, b) => b.share - a.share);
    const largest = ordered[0];
    const segments = [
        ...ordered.map((r, i) => ({ ...r, index: (i % 6) + 1, other: false })),
        ...(other ? [{ label: "Other", share: other, href: undefined, index: 0, other: true }] : []),
    ];
    const table = {
        head: ["Row", "Share"],
        rows: segments.map((s) => [s.label, formatShare(s.share)]),
    };
    return (_jsxs(ChartFigure, { kind: "share", caption: caption, table: table, children: [_jsx("div", { className: "ck-share", "aria-hidden": "true", children: segments.map((s) => (_jsx("span", { className: `ck-share-seg${s.other ? " ck-share-other" : ""}`, "data-series": s.index || undefined, style: { width: `${s.share * 100}%` }, title: `${s.label} ${formatShare(s.share)}`, children: s === segments[0] && largest && (_jsxs("span", { className: "ck-share-inside", children: [truncate(s.label, 14), " ", formatShare(s.share)] })) }, s.label))) }), _jsx("ol", { className: "ck-legend", "aria-hidden": "true", children: segments.map((s) => (_jsxs("li", { className: "ck-legend-item", children: [_jsx("span", { className: `ck-legend-swatch${s.other ? " ck-share-other" : ""}`, "data-series": s.index || undefined }), _jsx(MaybeLink, { href: s.href, className: "ck-legend-label", title: s.label, children: truncate(s.label, 22) }), _jsx("span", { className: "ck-legend-value", children: formatShare(s.share) })] }, s.label))) })] }));
}
//# sourceMappingURL=Bars.js.map