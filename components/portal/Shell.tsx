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
import { NAV_ACTION, navGroups } from '@/config/site-nav';
import { CALLS } from '@/config/substrata-calls';
import { CAPITAL_PROVIDERS } from '@/config/substrata-capital';
import { EVENTS } from '@/config/substrata-events';
import { INSTRUMENTS } from '@/config/substrata-policy';
import { SCIENCE } from '@/config/substrata-science';
import { BOTTLENECKS, portalTotals } from '@/lib/bottlenecks';
import { learnCount, noteCount } from '@/lib/notes';
import { MARKET_PARTICIPANTS } from '@/lib/participants';
import { SITE, correctionUrl } from '@/lib/site';
import { Mark, SearchIcon } from './Mark';
import { Megamenu, MobileMenu } from './Megamenu';

/**
 * Which menu group a page belongs to, so the right one reads as current.
 * Pages pass their own id; anything unrecognised simply highlights nothing.
 */
export const GROUP_FOR_PATH: Record<string, string> = {
  '': 'latest',
  events: 'latest',
  notes: 'latest',
  atlas: 'map',
  search: 'map',
  talent: 'map',
  data: 'about',
  development: 'about',
  roadmap: 'about',
  changelog: 'latest',
  chat: 'join',
  account: 'join',
  bottlenecks: 'map',
  markets: 'map',
  policy: 'map',
  science: 'map',
  capital: 'map',
  about: 'about',
  thesis: 'about',
  research: 'about',
  calls: 'about',
  learn: 'about',
  join: 'join',
};

const FOOTER_GROUPS = [
  {
    label: 'The map',
    links: [
      { href: '/bottlenecks', label: 'Bottlenecks' },
      { href: '/markets', label: 'Markets' },
      { href: '/policy', label: 'Policy' },
      { href: '/science', label: 'Science' },
      { href: '/capital', label: 'Capital' },
      { href: '/atlas', label: 'Chain atlas' },
      { href: '/talent', label: 'Talent & expertise' },
    ],
  },
  {
    label: 'Latest',
    links: [
      { href: '/', label: 'Today' },
      { href: '/events', label: 'Events' },
      { href: '/notes', label: 'Blog & development notes' },
      { href: '/changelog', label: 'Changelog' },
    ],
  },
  {
    label: 'About',
    links: [
      { href: '/learn', label: 'Learn' },
      { href: '/about', label: 'What this is' },
      { href: '/thesis', label: 'What we think' },
      { href: '/calls', label: 'Calls' },
      { href: '/research', label: 'Open questions' },
      { href: '/join', label: 'Join' },
      { href: '/roadmap', label: 'Roadmap' },
      { href: '/development', label: 'Development & vision' },
    ],
  },
  {
    label: 'Open',
    links: [
      { href: '/api/map', label: 'The map as JSON' },
      { href: SITE.repo, label: 'Source on GitHub' },
      { href: '/data', label: 'Data quality & exports' },
      { href: '/chat', label: 'Ask Substrata' },
      { href: '/account', label: 'Your research desk' },
    ],
  },
] as const;

export function Shell({
  currentPath,
  children,
}: {
  currentPath: string;
  children: React.ReactNode;
}) {
  const chrome = siteChrome();
  const totals = portalTotals();
  const groups = navGroups({
    bottlenecks: totals.bottlenecks,
    organisations: MARKET_PARTICIPANTS.length,
    rules: INSTRUMENTS.length,
    solutions: SCIENCE.length,
    events: EVENTS.length,
    notes: noteCount(),
    calls: CALLS.length,
    capital: CAPITAL_PROVIDERS.length,
    learn: learnCount(),
    bindingNow: BOTTLENECKS.filter((b) => b.horizon === 'now').length,
  });

  return (
    <div className="flex min-h-screen flex-col bg-surface-page">
      <header className="site-header sticky top-0 z-30 border-b border-subtle bg-surface-page/95 backdrop-blur">
        <div className="relative mx-auto flex max-w-shell items-center gap-3 px-4 py-2.5 sm:px-6 lg:gap-4 lg:px-8">
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-2 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Mark className="h-7 w-7 text-accent" />
            <span className="font-heading text-lg font-semibold tracking-display text-fg-primary">
              {chrome.name}
            </span>
          </Link>
          <Megamenu groups={groups} currentGroup={GROUP_FOR_PATH[currentPath]} />
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <form action="/search" className="site-search hidden lg:flex">
              <label className="sr-only" htmlFor="header-search">
                Search the research
              </label>
              <input
                id="header-search"
                name="q"
                type="search"
                placeholder="Try ASML or EUV"
                maxLength={200}
              />
              <button type="submit">Search</button>
            </form>
            <Link
              href="/search"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-fg-secondary hover:text-fg-primary lg:hidden"
              aria-label="Search the research"
            >
              <SearchIcon className="h-5 w-5" />
            </Link>
            <Link href="/chat" className="site-action hidden lg:inline-flex">
              Ask
            </Link>
            <Link href="/account" className="site-action hidden lg:inline-flex">
              Account
            </Link>
            <Link href={NAV_ACTION.href} className="site-join hidden lg:inline-flex">
              {NAV_ACTION.label}
            </Link>
            <MobileMenu groups={groups} />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mt-16 border-t border-subtle">
        <div className="mx-auto max-w-shell px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-10 max-w-xl">
            <p className="inline-flex items-center gap-2 font-heading text-lg font-semibold tracking-display text-fg-primary">
              <Mark className="h-6 w-6 text-accent" />
              {chrome.name}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-fg-secondary">{chrome.tagline}</p>
          </div>
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {FOOTER_GROUPS.map((group) => (
              <nav key={group.label} aria-label={group.label}>
                <h2 className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                  {group.label}
                </h2>
                <ul className="mt-2 space-y-1">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      {link.href.startsWith('/') ? (
                        <Link
                          href={link.href}
                          className="text-sm text-fg-secondary hover:text-fg-primary"
                        >
                          {link.label}
                        </Link>
                      ) : (
                        <a
                          href={link.href}
                          className="text-sm text-fg-secondary hover:text-fg-primary"
                        >
                          {link.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <div className="mt-10 border-t border-subtle pt-6">
            <a
              href={correctionUrl('Substrata')}
              className="font-mono text-xs uppercase tracking-caps text-fg-tertiary hover:text-fg-primary"
            >
              Report an error on GitHub
            </a>
            <p className="mt-3 max-w-prose text-xs leading-relaxed text-fg-muted">
              {chrome.footerNote}
            </p>
          </div>
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
