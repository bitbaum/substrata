/**
 * Two shells, from one config.
 *
 * Public pages: wordmark, three links, search, account. Footer is a legal
 * line plus three destinations. No sidebar.
 *
 * Desk (/account, /review): sidebar from DESK_NAV, no public megamenu, no
 * sitemap footer. That is the only place a sidebar belongs.
 */
import React from 'react';
import Link from 'next/link';

import { siteChrome } from '@/config/site-content';
import { DESK_NAV, FOOTER_NAV } from '@/config/site-nav';
import { currentSession, isReviewer } from '@/lib/auth';
import { SITE, correctionUrl } from '@/lib/site';
import { AccountMenu } from './AccountMenu';
import { Inquire } from './Inquire';
import { Mark, SearchIcon } from './Mark';
import { PublicNav } from './PublicNav';

const DESK_PATHS = new Set(['account', 'review']);

export function DeskSidebar({
  currentPath,
  items,
}: {
  currentPath: string;
  items: typeof DESK_NAV;
}) {
  const current = currentPath === '' ? '/' : `/${currentPath}`;
  return (
    <nav className="desk-sidebar" aria-label="Desk">
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={current === item.href ? 'page' : undefined}
              className="desk-sidebar-link"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export async function Shell({
  currentPath,
  children,
}: {
  currentPath: string;
  children: React.ReactNode;
}) {
  const chrome = siteChrome();
  const session = await currentSession();
  const desk = DESK_PATHS.has(currentPath) && Boolean(session?.actorId);
  const deskItems = DESK_NAV.filter(
    (item) => item.href !== '/review' || isReviewer(session?.actorId),
  );

  return (
    <div className={desk ? 'desk-shell' : 'flex min-h-screen flex-col bg-surface-page'}>
      <header className="site-header sticky top-0 z-30 border-b border-subtle bg-surface-page/95 backdrop-blur">
        <div className="relative mx-auto flex max-w-shell items-center gap-4 px-4 py-2.5 sm:px-6 lg:px-8">
          <Link
            href={desk ? '/account' : '/'}
            className="inline-flex shrink-0 items-center gap-2 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Mark className="h-7 w-7 text-fg-primary" />
            <span className="font-heading text-lg font-semibold tracking-display text-fg-primary">
              {chrome.name}
            </span>
          </Link>
          {!desk && <PublicNav currentPath={currentPath} />}
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <form action="/search" className="site-search hidden md:flex">
              <label className="sr-only" htmlFor="header-search">
                Search the research
              </label>
              <input
                id="header-search"
                name="q"
                type="search"
                placeholder="ASML, EUV, quartz"
                maxLength={200}
              />
              <button type="submit">Search</button>
            </form>
            <Link
              href="/search"
              className="inline-flex h-11 w-11 items-center justify-center text-fg-secondary hover:text-fg-primary md:hidden"
              aria-label="Search the research"
            >
              <SearchIcon className="h-5 w-5" />
            </Link>
            <AccountMenu />
          </div>
        </div>
      </header>
      {desk && <DeskSidebar currentPath={currentPath} items={deskItems} />}
      <main className="flex-1">{children}</main>
      <footer className="site-footer mt-auto border-t border-subtle">
        <div className="mx-auto flex max-w-shell flex-col gap-4 px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p className="max-w-xl text-xs leading-relaxed text-fg-muted">{chrome.footerNote}</p>
          {!desk && (
            <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {FOOTER_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-fg-secondary hover:text-fg-primary"
                >
                  {item.label}
                </Link>
              ))}
              <a href={SITE.repo} className="text-fg-secondary hover:text-fg-primary">
                Source
              </a>
              <a
                href={correctionUrl('Substrata')}
                className="text-fg-secondary hover:text-fg-primary"
              >
                Correction
              </a>
            </nav>
          )}
        </div>
      </footer>
    </div>
  );
}

export function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-shell px-4 py-10 sm:px-6 sm:py-12 lg:px-8">{children}</div>;
}

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
        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden border border-subtle bg-border-subtle lg:grid-cols-4">
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

export function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="font-mono text-xs uppercase tracking-caps text-fg-tertiary sm:mr-1 sm:w-20 sm:shrink-0">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function Empty({ what, next, topic }: { what: string; next?: string; topic?: string }) {
  return (
    <div className="border border-dashed border-strong px-5 py-8 text-center">
      <p className="text-sm text-fg-secondary">{what}</p>
      {next && <p className="mt-1 text-xs text-fg-muted">{next}</p>}
      {topic && (
        <div className="mt-4">
          <Inquire topic={topic} />
        </div>
      )}
    </div>
  );
}
