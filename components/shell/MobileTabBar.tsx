'use client';

/**
 * Below 768px: four destinations and "More" in a bar at the thumb, the shape
 * OrangeCat's MobileBottomNav and Loki's MobileNav both arrived at. Each tab
 * carries its label inside the control (contract rule 4) and is 44px or more
 * tall; the bar sits above the home indicator via the safe-area inset.
 *
 * "More" lights up when the page is not one of the four, so the bar still
 * answers "where am I" from every page.
 */
import Link from 'next/link';

import { MOBILE_TABS, currentHref } from '@/config/site-nav';
import { NavIcon } from './NavIcon';

export function MobileTabBar({
  pathname,
  moreOpen,
  onMore,
}: {
  pathname: string;
  moreOpen: boolean;
  onMore: () => void;
}) {
  const here = currentHref(pathname, MOBILE_TABS);
  const moreHere = moreOpen || here === null;
  return (
    <nav aria-label="Primary" className="shell-tabbar" data-shell>
      {MOBILE_TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className="shell-tab"
          aria-current={here === tab.href && !moreOpen ? 'page' : undefined}
        >
          <NavIcon name={tab.icon} />
          <span>{tab.label}</span>
        </Link>
      ))}
      <button
        type="button"
        className="shell-tab"
        data-here={moreHere || undefined}
        aria-expanded={moreOpen}
        aria-controls="shell-more"
        onClick={onMore}
      >
        <NavIcon name="more" />
        <span>More</span>
      </button>
    </nav>
  );
}
