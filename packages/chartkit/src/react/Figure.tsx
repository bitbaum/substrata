import type { ReactNode } from "react";

/**
 * The frame every chart shares: a `<figure class="ck-chart">`, the drawing,
 * the caption, and a visually hidden `<table>` of the same values. Nothing a
 * chart says is reachable only by pointing at it. The drawing's decorative
 * parts (the SVG, the ticks, the bars) carry `aria-hidden` themselves; the
 * anchors in it do not, because a keyboard reaches them and a reader must be
 * told what they are.
 */
export function ChartFigure({
  kind,
  caption,
  table,
  children,
  style,
}: {
  kind: string;
  caption: string;
  table: { head: string[]; rows: (string | number)[][] };
  children: ReactNode;
  style?: Record<string, string | number>;
}) {
  return (
    <figure className={`ck-chart ck-chart-${kind}`} style={style}>
      <div className="ck-chart-draw">{children}</div>
      <figcaption className="ck-chart-caption">{caption}</figcaption>
      <DataTable caption={caption} head={table.head} rows={table.rows} />
    </figure>
  );
}

/** The values behind a chart, as a table a screen reader walks and a test reads. */
export function DataTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="ck-sr">
      <table className="ck-chart-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) =>
                j === 0 ? (
                  <th key={j} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={j}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A label that is an anchor when it has somewhere to go, else a span. */
export function MaybeLink({
  href,
  className,
  title,
  children,
  style,
}: {
  href?: string;
  className: string;
  title?: string;
  children: ReactNode;
  style?: Record<string, string | number>;
}) {
  if (href) {
    const out = /^https?:\/\//.test(href);
    return (
      <a
        href={href}
        className={className}
        title={title}
        style={style}
        {...(out ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  }
  return (
    <span className={className} title={title} style={style}>
      {children}
    </span>
  );
}
