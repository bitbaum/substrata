/**
 * The shell every page renders inside. The chrome itself is client-side
 * (components/shell/AppFrame.tsx: sidebar, top bar, tab bar, palette); this
 * server half reads the session once and hands down only what differs by
 * reader — whether they are signed in, whether they review, and the account
 * menu, which needs server actions to sign in and out.
 *
 * The current page comes from the URL (usePathname), not from a prop each
 * page passed, so a sub-page like /careers/paths marks its own row.
 */
import React from 'react';
import Link from 'next/link';

import { siteChrome } from '@/config/site-content';
import { FOOTER_NAV } from '@/config/site-nav';
import { currentSession, isReviewer } from '@/lib/auth';
import { SITE, correctionUrl } from '@/lib/site';
import { AppFrame } from '@/components/shell/AppFrame';
import { AccountMenu } from './AccountMenu';
import { FreshnessBadge } from './FreshnessBadge';
import { Inquire } from './Inquire';

function Footer({ note }: { note: string }) {
  return (
    <footer className="site-footer mt-auto border-t border-subtle">
      <div className="mx-auto flex max-w-shell flex-col gap-4 px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="max-w-xl">
          <p className="text-xs leading-relaxed text-fg-muted">{note}</p>
          <FreshnessBadge />
        </div>
        <nav aria-label="About Substrata" className="site-footer-nav">
          {FOOTER_NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
          <a href={SITE.repo}>Source</a>
          <a href={correctionUrl('Substrata')}>Correction</a>
        </nav>
      </div>
    </footer>
  );
}

export async function Shell({ children }: { children: React.ReactNode }) {
  const chrome = siteChrome();
  const session = await currentSession();
  const actorId = session?.actorId;
  return (
    <AppFrame
      name={chrome.name}
      signedIn={Boolean(actorId)}
      reviewer={isReviewer(actorId)}
      account={<AccountMenu />}
      footer={<Footer note={chrome.footerNote} />}
    >
      {children}
    </AppFrame>
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
  stats?: { label: string; value: React.ReactNode; note?: React.ReactNode }[];
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
