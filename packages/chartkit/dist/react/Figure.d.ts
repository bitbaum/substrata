import type { ReactNode } from "react";
/**
 * The frame every chart shares: a `<figure class="ck-chart">`, the drawing,
 * the caption, and a visually hidden `<table>` of the same values. Nothing a
 * chart says is reachable only by pointing at it. The drawing's decorative
 * parts (the SVG, the ticks, the bars) carry `aria-hidden` themselves; the
 * anchors in it do not, because a keyboard reaches them and a reader must be
 * told what they are.
 */
export declare function ChartFigure({ kind, caption, table, children, style, }: {
    kind: string;
    caption: string;
    table: {
        head: string[];
        rows: (string | number)[][];
    };
    children: ReactNode;
    style?: Record<string, string | number>;
}): import("react").JSX.Element;
/** The values behind a chart, as a table a screen reader walks and a test reads. */
export declare function DataTable({ caption, head, rows, }: {
    caption: string;
    head: string[];
    rows: (string | number)[][];
}): import("react").JSX.Element;
/** A label that is an anchor when it has somewhere to go, else a span. */
export declare function MaybeLink({ href, className, title, children, style, }: {
    href?: string;
    className: string;
    title?: string;
    children: ReactNode;
    style?: Record<string, string | number>;
}): import("react").JSX.Element;
//# sourceMappingURL=Figure.d.ts.map