'use client';

/**
 * One shell for every page, signed in or not — the arrangement Loki's
 * AppShell settled on: sidebar, then a column of top bar, page and footer;
 * a bottom tab bar below 768px; the palette over all of it.
 *
 * There used to be two shells. Signed out, a header with three dropdowns;
 * signed in, a seventeen-row desk sidebar that vanished below 1024px, while
 * the header's own menu was hidden for signed-in readers above 819px — so on
 * a tablet a signed-in reader had no navigation at all. The research list is
 * the same for everyone now, and what differs by session (desk, settings,
 * inbox, sign out) is the account menu's business.
 */
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { CommandPalette } from './CommandPalette';
import { MobileTabBar } from './MobileTabBar';
import { MoreSheet } from './MoreSheet';
import { paletteEntries } from './palette';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable;
}

export function AppFrame({
  name,
  signedIn,
  reviewer,
  account,
  footer,
  children,
}: {
  name: string;
  signedIn: boolean;
  reviewer: boolean;
  account: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? '/';
  const [palette, setPalette] = useState(false);
  const [more, setMore] = useState(false);
  const entries = useMemo(() => paletteEntries({ signedIn, reviewer }), [signedIn, reviewer]);
  const closePalette = useCallback(() => setPalette(false), []);
  const closeMore = useCallback(() => setMore(false), []);
  const openPalette = useCallback(() => {
    setMore(false);
    setPalette(true);
  }, []);

  // A navigation closes whatever overlay led to it.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMore(false);
    setPalette(false);
  }

  // ⌘K / Ctrl+K toggles the palette anywhere. "/" opens it too — except on
  // /search, where "/" belongs to the page's own search box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((open) => !open);
        return;
      }
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (pathname === '/search' || isTyping(e.composedPath()[0] ?? e.target)) return;
      e.preventDefault();
      setPalette(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pathname]);

  return (
    <div className="shell">
      <a href="#main" className="shell-skip">
        Skip to content
      </a>
      <Sidebar pathname={pathname} name={name} />
      <div className="shell-column">
        <TopBar
          pathname={pathname}
          name={name}
          signedIn={signedIn}
          account={account}
          onSearch={openPalette}
        />
        <main id="main" className="shell-page">
          {children}
        </main>
        {footer}
      </div>
      <MobileTabBar pathname={pathname} moreOpen={more} onMore={() => setMore((o) => !o)} />
      {more && <MoreSheet pathname={pathname} onClose={closeMore} onSearch={openPalette} />}
      {palette && <CommandPalette entries={entries} onClose={closePalette} />}
    </div>
  );
}
