/**
 * The portal's chrome: a masthead with the section navigation, and a footer
 * carrying everything that is not a section.
 *
 * Six sections, because that is how the material actually divides: what
 * changed (Today), what is constrained (Bottlenecks), who makes it (Markets),
 * what the rules do (Policy), what would remove it (Science), and the
 * open questions (Research). About holds the method, the glossary and the
 * disclosures.
 */

import React from 'react';
import Link from 'next/link';

import { siteChrome } from '@/config/site-content';
import { SITE, correctionUrl } from '@/lib/site';

export const PORTAL_NAV = [
  { path: '', label: 'Today' },
  { path: 'bottlenecks', label: 'Bottlenecks' },
  { path: 'markets', label: 'Markets' },
  { path: 'policy', label: 'Policy' },
  { path: 'science', label: 'Science' },
  { path: 'research', label: 'Research' },
  { path: 'about', label: 'About' },
] as const;

const FOOTER_LINKS = [
  { href: '/events', label: 'Events' },
  { href: '/thesis', label: 'Thesis' },
  { href: '/about', label: 'Method & glossary' },
  { href: '/api/map', label: 'API' },
  { href: SITE.repo, label: 'Source on GitHub' },
] as const;

function Nav({ currentPath }: { currentPath: string }) {
  return (
    <nav aria-label="Sections" className="-mx-1 flex gap-x-1 overflow-x-auto scrollbar-hide">
      {PORTAL_NAV.map((item) => {
        const current = item.path === currentPath;
        return (
          <Link
            key={item.path}
            href={item.path ? `/${item.path}` : '/'}
            aria-current={current ? 'page' : undefined}
            className={[
              'inline-flex min-h-11 shrink-0 items-center rounded px-2 font-mono text-xs uppercase tracking-caps transition-colors',
              current
                ? 'text-fg-primary underline decoration-accent decoration-2 underline-offset-8'
                : 'text-fg-tertiary hover:text-fg-primary',
            ].join(' ')}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Shell({
  currentPath,
  children,
}: {
  currentPath: string;
  children: React.ReactNode;
}) {
  const chrome = siteChrome();
  return (
    <div className="flex min-h-screen flex-col bg-surface-page">
      <header className="sticky top-0 z-30 border-b border-subtle bg-surface-page/90 backdrop-blur">
        <div className="mx-auto flex max-w-shell flex-col gap-1 px-4 py-2 sm:flex-row sm:items-center sm:gap-6 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex shrink-0 items-center rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="font-heading text-lg font-semibold tracking-display text-fg-primary">
              {chrome.name}
            </span>
          </Link>
          <Nav currentPath={currentPath} />
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mt-16 border-t border-subtle">
        <div className="mx-auto flex max-w-shell flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
          <nav aria-label="More" className="flex flex-wrap gap-x-6 gap-y-2">
            {FOOTER_LINKS.map((link) =>
              link.href.startsWith('/') ? (
                <Link
                  key={link.href}
                  href={link.href}
                  className="font-mono text-xs uppercase tracking-caps text-fg-tertiary hover:text-fg-primary"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  className="font-mono text-xs uppercase tracking-caps text-fg-tertiary hover:text-fg-primary"
                >
                  {link.label}
                </a>
              ),
            )}
            <a
              href={correctionUrl('Substrata')}
              className="font-mono text-xs uppercase tracking-caps text-fg-tertiary hover:text-fg-primary"
            >
              Report an error on GitHub
            </a>
          </nav>
          <p className="max-w-prose text-xs leading-relaxed text-fg-muted">{chrome.footerNote}</p>
        </div>
      </footer>
    </div>
  );
}

/** Page width and vertical rhythm, shared by every portal page. */
export function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-shell px-4 py-10 sm:px-6 sm:py-12 lg:px-8">{children}</div>;
}

/**
 * The top of a section: what it is in one plain sentence, then the numbers.
 * Every section opens the same way, so a reader who has understood one
 * understands the shape of the rest.
 */
export function SectionHeader({
  title,
  lede,
  stats,
  action,
}: {
  title: string;
  lede: string;
  stats?: { label: string; value: string | number; note?: string }[];
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-display text-fg-primary sm:text-4xl">
          {title}
        </h1>
        {action && <div className="text-sm">{action}</div>}
      </div>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-fg-secondary">{lede}</p>
      {stats && stats.length > 0 && (
        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-subtle bg-border-subtle lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-surface-raised px-4 py-3 sm:px-5">
              <dt className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                {stat.label}
              </dt>
              <dd className="mt-1.5 font-heading text-2xl font-semibold tabular-nums text-fg-primary sm:text-3xl">
                {stat.value}
              </dd>
              {stat.note && (
                <dd className="mt-1 text-xs leading-snug text-fg-muted">{stat.note}</dd>
              )}
            </div>
          ))}
        </dl>
      )}
    </header>
  );
}

/** A section heading inside a page: a mono index and a serif title. */
export function Heading({
  index,
  title,
  aside,
}: {
  index?: string;
  title: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <h2 className="flex items-baseline gap-3 font-heading text-xl font-semibold tracking-display text-fg-primary sm:text-2xl">
        {index && <span className="font-mono text-xs text-fg-muted">{index}</span>}
        {title}
      </h2>
      {aside && <div className="text-sm text-fg-tertiary">{aside}</div>}
    </div>
  );
}

/**
 * What a column of jargon means, folded away. Open it once and the table
 * stops being a private language; leave it closed and the table is unchanged.
 */
export function Legend({ items }: { items: { term: string; detail: string }[] }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="inline-flex cursor-pointer items-center gap-2 font-mono text-xs uppercase tracking-caps text-fg-tertiary hover:text-fg-primary">
        What these columns mean
      </summary>
      <dl className="mt-3 grid gap-x-8 gap-y-3 border-l-2 border-subtle pl-4 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.term}>
            <dt className="font-medium text-fg-primary">{item.term}</dt>
            <dd className="mt-0.5 max-w-prose text-sm leading-relaxed text-fg-tertiary">
              {item.detail}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** A row of filter chips with a label. Used by every section list. */
export function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {/* The label sits above the chips on a phone: side by side, a wrapping
          chip row slides under a fixed-width label and collides with it. */}
      <span className="font-mono text-xs uppercase tracking-caps text-fg-tertiary sm:mr-1 sm:w-20 sm:shrink-0">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** An honest empty state: says what is missing and what would fill it. */
export function Empty({ what, next }: { what: string; next?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-strong px-5 py-8 text-center">
      <p className="text-sm text-fg-secondary">{what}</p>
      {next && <p className="mt-1 text-xs text-fg-muted">{next}</p>}
    </div>
  );
}
