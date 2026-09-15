/**
 * The navigation: grouped panels on a wide screen, a disclosure list on a
 * narrow one, and no JavaScript in either.
 *
 * A menu that only opens on hover is unusable by keyboard and invisible to a
 * phone, so this one opens on `group-hover` AND on `focus-within`, which
 * means tabbing into a group opens it and tabbing out closes it. On a phone
 * there is no hover at all, so the same data renders inside a `<details>`
 * element that the browser opens on tap.
 *
 * Both halves render from `config/site-nav.ts`, so a destination is added in
 * one place and appears in both.
 */

import React from 'react';
import Link from 'next/link';

import { NAV_ACTION, type NavGroup } from '@/config/site-nav';

function ItemLink({
  item,
  onDark = false,
}: {
  item: { label: string; href: string; blurb: string; badge?: string };
  onDark?: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={[
        'block rounded-md px-3 py-2 transition-colors',
        onDark ? 'hover:bg-surface-page' : 'hover:bg-surface-raised',
      ].join(' ')}
    >
      <span className="flex items-baseline gap-2">
        <span className="font-medium text-fg-primary">{item.label}</span>
        {item.badge && (
          <span className="font-mono text-xs tabular-nums text-fg-muted">{item.badge}</span>
        )}
      </span>
      <span className="mt-0.5 block text-xs leading-snug text-fg-tertiary">{item.blurb}</span>
    </Link>
  );
}

/** Wide screens: a row of groups, each opening a panel below it. */
function WideNav({ groups, currentGroup }: { groups: NavGroup[]; currentGroup?: string }) {
  return (
    <nav aria-label="Sections" className="hidden items-center gap-1 lg:flex">
      {groups.map((group) => (
        <div key={group.id} className="group/nav relative">
          <button
            type="button"
            aria-expanded="false"
            className={[
              'inline-flex min-h-11 items-center gap-1.5 rounded px-3 font-mono text-xs uppercase tracking-caps transition-colors',
              currentGroup === group.id
                ? 'text-fg-primary'
                : 'text-fg-tertiary hover:text-fg-primary',
              'group-hover/nav:text-fg-primary group-focus-within/nav:text-fg-primary',
            ].join(' ')}
          >
            {group.label}
            <span aria-hidden className="text-[0.6rem] opacity-60">
              ▾
            </span>
          </button>

          {/* The panel. Invisible rather than absent, so focus can reach it. */}
          <div
            className={[
              'invisible absolute left-0 top-full z-40 w-[34rem] opacity-0 transition-opacity duration-100',
              'group-hover/nav:visible group-hover/nav:opacity-100',
              'group-focus-within/nav:visible group-focus-within/nav:opacity-100',
            ].join(' ')}
          >
            <div className="mt-1 overflow-hidden rounded-lg border border-strong bg-surface-page shadow-lg">
              <p className="border-b border-subtle px-4 py-2.5 text-xs leading-snug text-fg-tertiary">
                {group.blurb}
              </p>
              <div className="grid grid-cols-2 gap-1 p-2">
                {group.items.map((item) => (
                  <ItemLink key={item.href} item={item} />
                ))}
              </div>
              {group.feature && (
                <Link
                  href={group.feature.href}
                  className="flex items-baseline justify-between gap-4 border-t border-subtle bg-surface-raised px-4 py-3 transition-colors hover:bg-surface-page"
                >
                  <span>
                    <span className="font-medium text-accent">{group.feature.label}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-fg-tertiary">
                      {group.feature.blurb}
                    </span>
                  </span>
                  <span aria-hidden className="text-accent">
                    →
                  </span>
                </Link>
              )}
            </div>
          </div>
        </div>
      ))}
    </nav>
  );
}

/** Narrow screens: one disclosure holding every group. */
function NarrowNav({ groups }: { groups: NavGroup[] }) {
  return (
    <details className="lg:hidden [&[open]_.chev]:rotate-180">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 font-mono text-xs uppercase tracking-caps text-fg-tertiary">
        Menu
        <span aria-hidden className="chev text-[0.6rem] transition-transform">
          ▾
        </span>
      </summary>
      <div className="absolute inset-x-0 z-40 mt-2 max-h-[80vh] overflow-y-auto border-y border-strong bg-surface-page px-4 py-3 shadow-lg sm:px-6">
        {groups.map((group) => (
          <section key={group.id} className="border-b border-subtle py-3 last:border-0">
            <h2 className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
              {group.label}
            </h2>
            <div className="mt-1 grid gap-0.5 sm:grid-cols-2">
              {group.items.map((item) => (
                <ItemLink key={item.href} item={item} onDark />
              ))}
            </div>
          </section>
        ))}
        <Link
          href={NAV_ACTION.href}
          className="mt-3 flex min-h-11 items-center justify-center rounded-md bg-accent px-4 font-medium text-surface-page"
        >
          {NAV_ACTION.label}
        </Link>
      </div>
    </details>
  );
}

export function Megamenu({ groups, currentGroup }: { groups: NavGroup[]; currentGroup?: string }) {
  return (
    <>
      <WideNav groups={groups} currentGroup={currentGroup} />
      <NarrowNav groups={groups} />
      <Link
        href={NAV_ACTION.href}
        className="ml-auto hidden min-h-9 items-center rounded-full border border-accent px-4 text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-surface-page lg:inline-flex"
      >
        {NAV_ACTION.label}
      </Link>
    </>
  );
}
