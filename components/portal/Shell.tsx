/**
 * The portal's chrome: sitekit's masthead with the portal's own navigation,
 * and a footer that carries the long-form pages the nav no longer does.
 *
 * Four entries in the nav, because a reader scanning for the state of the
 * world needs the board, the research, the view and where to read the rules
 * — everything else is one click further down. The document pages still
 * exist and are still generated from the same config; they are simply no
 * longer the front of the site.
 */

import React from 'react';
import Link from 'next/link';
import { SiteMasthead } from 'sitekit/react';

import { siteChrome } from '@/config/site-content';
import { SITE, correctionUrl } from '@/lib/site';

export const PORTAL_NAV = [
  { path: '', label: 'Today' },
  { path: 'board', label: 'Board' },
  { path: 'events', label: 'Events' },
  { path: 'research', label: 'Research' },
  { path: 'thesis', label: 'Thesis' },
  { path: 'mandate', label: 'About' },
] as const;

const FOOTER_LINKS = [
  { href: '/chokepoints', label: 'Chokepoints' },
  { href: '/participants', label: 'Participants' },
  { href: '/acting', label: 'Acting on it' },
  { href: '/disclosure', label: 'Disclosure' },
  { href: '/api/map', label: 'API' },
  { href: SITE.repo, label: 'Source' },
] as const;

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
      <SiteMasthead
        chrome={chrome}
        navItems={PORTAL_NAV.map((item) => ({ path: item.path, label: item.label }))}
        currentPath={currentPath}
        Link={Link}
      />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-subtle">
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
              Report an error
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

/** A section heading in the portal: a mono index and a serif title, one line under it at most. */
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
