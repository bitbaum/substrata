import React from 'react';
import Link from 'next/link';

/**
 * One block of a role view: what it is, why it is here for this reader, and
 * the way into the full screen it was taken from.
 */
export function RoleSection({
  index,
  title,
  why,
  href,
  more,
  status,
  wide,
  children,
}: {
  index: string;
  title: string;
  /** One line: why this reader would look at it. */
  why: string;
  href: string;
  more: string;
  /** When its data was read, if it comes from a feed. */
  status?: React.ReactNode;
  /** Spans both columns on a wide screen. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`role-section${wide ? ' is-wide' : ''}`}>
      <header className="role-section-head">
        <h2>
          <span className="role-section-index">{index}</span>
          {title}
        </h2>
        <p className="role-section-why">{why}</p>
        {status && <p className="role-section-status">{status}</p>}
      </header>
      <div className="role-section-body">{children}</div>
      <p className="role-section-more">
        <Link href={href}>{more} →</Link>
      </p>
    </section>
  );
}

/** The five doors, as tabs on every role view. */
export function RoleTabs({
  current,
  items,
}: {
  current: string;
  items: readonly { id: string; iAm: string; href: string }[];
}) {
  return (
    <nav className="role-tabs" aria-label="Views by reader">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          aria-current={item.id === current ? 'page' : undefined}
          className="role-tab"
        >
          {item.iAm}
        </Link>
      ))}
    </nav>
  );
}
