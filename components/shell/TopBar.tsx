'use client';

/**
 * The bar above every page. Left to right: where you are going (search,
 * which opens the palette), then the one invitation (Join), then who you are
 * (the account menu, last, where a hand looks for it). Loki's AppTopBar rule
 * holds here too: account actions live in this bar, never in the sidebar.
 *
 * Below 768px there is no sidebar, so the bar carries the wordmark and the
 * search collapses to a 44px icon; Join moves into the "More" sheet.
 */
import Link from 'next/link';
import { useSyncExternalStore, type ReactNode } from 'react';

import { ACCOUNT_NAV, HOME_LINK, NAV_ACTION, isCurrent } from '@/config/site-nav';
import { Mark, SearchIcon } from '@/components/portal/Mark';

function useShortcutLabel(): string {
  return useSyncExternalStore(
    () => () => {},
    () => (/mac|iphone|ipad/i.test(navigator.platform) ? '⌘K' : 'Ctrl K'),
    () => '⌘K',
  );
}

export function TopBar({
  pathname,
  name,
  signedIn,
  account,
  onSearch,
}: {
  pathname: string;
  name: string;
  signedIn: boolean;
  account: ReactNode;
  onSearch: () => void;
}) {
  const shortcut = useShortcutLabel();
  return (
    <header className="shell-topbar" data-shell>
      <Link href={HOME_LINK.href} className="shell-topbar-brand">
        <Mark className="h-7 w-7 shrink-0" />
        <span>{name}</span>
      </Link>
      <button
        type="button"
        className="shell-search"
        onClick={onSearch}
        aria-haspopup="dialog"
        aria-label="Search pages and research"
      >
        <SearchIcon className="h-5 w-5 shrink-0" />
        <span className="shell-search-label">Search bottlenecks, companies, pages</span>
        <kbd className="shell-kbd" aria-hidden>
          {shortcut}
        </kbd>
      </button>
      <div className="shell-topbar-end">
        {signedIn && (
          <Link
            href={ACCOUNT_NAV.desk.href}
            className="shell-topbar-link"
            aria-current={isCurrent(pathname, ACCOUNT_NAV.desk.href) ? 'page' : undefined}
          >
            {ACCOUNT_NAV.desk.label}
          </Link>
        )}
        <Link
          href={NAV_ACTION.href}
          className="shell-join"
          aria-current={isCurrent(pathname, NAV_ACTION.href) ? 'page' : undefined}
        >
          {NAV_ACTION.label}
        </Link>
        {account}
      </div>
    </header>
  );
}
