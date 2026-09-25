'use client';

/**
 * The phone's "More": every section, as a sheet rising from the tab bar.
 *
 * Same sections, same order and same one-line hints as the sidebar, so a
 * reader who learns the site on a phone finds it where they left it on a
 * laptop. Search sits first because on a phone it is the fastest way to any
 * of the rows below it. No account actions here: those live in the account
 * menu in the top bar on every width, as in Loki's MobileNavSheet.
 */
import Link from 'next/link';
import { useRef } from 'react';

import {
  FOOTER_NAV,
  HOME_LINK,
  NAV_ACTION,
  NAV_SECTIONS,
  RESEARCH_NAV,
  currentHref,
  navPaths,
  type NavLink,
} from '@/config/site-nav';
import { SearchIcon } from '@/components/portal/Mark';
import { NavIcon } from './NavIcon';
import { useDialog } from './use-dialog';

const EVERY = navPaths().map((href) => ({ href }) as NavLink);
/** The project's own pages that are not already a row in a section above. */
const ABOUT = FOOTER_NAV.filter(
  (item) => item.href !== NAV_ACTION.href && !RESEARCH_NAV.some((r) => r.href === item.href),
);

function Row({ item, here }: { item: NavLink; here: string | null }) {
  return (
    <Link
      href={item.href}
      className="shell-row"
      aria-current={here === item.href ? 'page' : undefined}
    >
      <span className="shell-row-label">{item.label}</span>
      <span className="shell-row-hint">{item.hint}</span>
    </Link>
  );
}

export function MoreSheet({
  pathname,
  onClose,
  onSearch,
}: {
  pathname: string;
  onClose: () => void;
  onSearch: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useDialog(panel, onClose);
  const here = currentHref(pathname, EVERY);

  return (
    <div className="shell-overlay">
      <div className="shell-backdrop" aria-hidden onClick={onClose} />
      <div
        ref={panel}
        id="shell-more"
        role="dialog"
        aria-modal="true"
        aria-label="All pages"
        className="shell-sheet"
      >
        <div className="shell-sheet-head">
          <p>All pages</p>
          <button type="button" className="shell-icon-button" onClick={onClose} aria-label="Close">
            <NavIcon name="close" />
          </button>
        </div>
        <div className="shell-sheet-body">
          <button type="button" className="shell-sheet-search" onClick={onSearch}>
            <SearchIcon className="h-5 w-5 shrink-0" />
            <span>Search bottlenecks, companies, pages</span>
          </button>
          <Row item={HOME_LINK} here={here} />
          {NAV_SECTIONS.map((section) => (
            <section key={section.id} className="shell-sheet-group" aria-label={section.label}>
              <p className="shell-sheet-label">{section.label}</p>
              {section.items.map((item) => (
                <Row key={item.href} item={item} here={here} />
              ))}
            </section>
          ))}
          <section className="shell-sheet-group" aria-label="About Substrata">
            <p className="shell-sheet-label">About</p>
            {ABOUT.map((item) => (
              <Row key={item.href} item={item} here={here} />
            ))}
          </section>
          <Link
            href={NAV_ACTION.href}
            className="shell-sheet-action"
            aria-current={here === NAV_ACTION.href ? 'page' : undefined}
          >
            {NAV_ACTION.label}: {NAV_ACTION.hint}
          </Link>
        </div>
      </div>
    </div>
  );
}
