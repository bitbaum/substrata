import React from 'react';

/**
 * The one page header for working screens: kicker, title, a status line of
 * live counts and freshness, and actions on the right.
 *
 * Before this, /careers, /exposure and the desk each wrote the same four
 * elements by hand with their own wrapper class, and the science and series
 * pages used a different header altogether — so moving between two pages
 * built the same week felt like moving between two sites.
 */
export function PageHeader({
  kicker,
  title,
  status,
  note,
  actions,
  children,
}: {
  /** Section name, or a breadcrumb. */
  kicker: React.ReactNode;
  title: React.ReactNode;
  /** Live counts and when they were read. Never marketing. */
  status?: React.ReactNode;
  /** What the page is not, or how to read it. */
  note?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="page-head-top">
        <p className="desk-kicker">{kicker}</p>
        {actions && <div className="page-head-actions">{actions}</div>}
      </div>
      <h1 className="desk-title">{title}</h1>
      {status && <p className="desk-status">{status}</p>}
      {note && <div className="page-head-note">{note}</div>}
      {children}
    </header>
  );
}
