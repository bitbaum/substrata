import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The frame every chart shares: a `<figure class="ck-chart">`, the drawing,
 * the caption, and a visually hidden `<table>` of the same values. Nothing a
 * chart says is reachable only by pointing at it. The drawing's decorative
 * parts (the SVG, the ticks, the bars) carry `aria-hidden` themselves; the
 * anchors in it do not, because a keyboard reaches them and a reader must be
 * told what they are.
 */
export function ChartFigure({ kind, caption, table, children, style, }) {
    return (_jsxs("figure", { className: `ck-chart ck-chart-${kind}`, style: style, children: [_jsx("div", { className: "ck-chart-draw", children: children }), _jsx("figcaption", { className: "ck-chart-caption", children: caption }), _jsx(DataTable, { caption: caption, head: table.head, rows: table.rows })] }));
}
/** The values behind a chart, as a table a screen reader walks and a test reads. */
export function DataTable({ caption, head, rows, }) {
    return (_jsx("div", { className: "ck-sr", children: _jsxs("table", { className: "ck-chart-table", children: [_jsx("caption", { children: caption }), _jsx("thead", { children: _jsx("tr", { children: head.map((h) => (_jsx("th", { scope: "col", children: h }, h))) }) }), _jsx("tbody", { children: rows.map((row, i) => (_jsx("tr", { children: row.map((cell, j) => j === 0 ? (_jsx("th", { scope: "row", children: cell }, j)) : (_jsx("td", { children: cell }, j))) }, i))) })] }) }));
}
/** A label that is an anchor when it has somewhere to go, else a span. */
export function MaybeLink({ href, className, title, children, style, }) {
    if (href) {
        const out = /^https?:\/\//.test(href);
        return (_jsx("a", { href: href, className: className, title: title, style: style, ...(out ? { target: "_blank", rel: "noopener noreferrer" } : {}), children: children }));
    }
    return (_jsx("span", { className: className, title: title, style: style, children: children }));
}
//# sourceMappingURL=Figure.js.map