import Link from 'next/link';
import { NAV_ACTION, NAV_GROUPS, isCurrent, type NavLink } from '@/config/site-nav';
import { DetailsMenu } from './DetailsMenu';

/**
 * The public header nav, in two shapes from one list.
 *
 * `PublicNav` is the wide shape: three group menus and one action, never more
 * than four things on a line, so the header stays one row instead of wrapping
 * nine uppercase links onto two. `MobileMenu` is the narrow shape: one panel,
 * full width, with the same groups stacked.
 *
 * Both are `<details>`, so neither needs JavaScript to open — `DetailsMenu`
 * only adds closing on Escape and on a click outside, which also closes one
 * group menu when another is opened.
 */

function normalise(currentPath: string): string {
  return currentPath === '' ? '/' : `/${currentPath}`;
}

function MenuItem({ item, current }: { item: NavLink; current: string }) {
  return (
    <Link
      href={item.href}
      aria-current={isCurrent(current, item.href) ? 'page' : undefined}
      className="nav-item"
    >
      <span className="nav-item-label">{item.label}</span>
      <span className="nav-item-hint">{item.hint}</span>
    </Link>
  );
}

export function PublicNav({
  currentPath,
  extra = [],
}: {
  currentPath: string;
  extra?: readonly NavLink[];
}) {
  const current = normalise(currentPath);
  return (
    <nav aria-label="Primary" className="public-nav">
      {extra.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isCurrent(current, item.href) ? 'page' : undefined}
          className="public-nav-link"
        >
          {item.label}
        </Link>
      ))}
      {NAV_GROUPS.map((group) => {
        // The group marks itself when the reader is inside it, so a dropdown
        // does not hide the fact that you are already somewhere.
        const here = group.items.some((item) => isCurrent(current, item.href));
        return (
          <DetailsMenu key={group.label} className="public-nav-group">
            <summary aria-current={here ? 'page' : undefined}>
              {group.label}
              <svg aria-hidden="true" viewBox="0 0 10 6" className="nav-caret">
                <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </summary>
            <div className="public-nav-panel">
              {group.items.map((item) => (
                <MenuItem key={item.href} item={item} current={current} />
              ))}
            </div>
          </DetailsMenu>
        );
      })}
      <Link
        href={NAV_ACTION.href}
        aria-current={isCurrent(current, NAV_ACTION.href) ? 'page' : undefined}
        className="public-nav-action"
      >
        {NAV_ACTION.label}
      </Link>
    </nav>
  );
}

export function MobileMenu({
  currentPath,
  extra = [],
}: {
  currentPath: string;
  extra?: readonly NavLink[];
}) {
  const current = normalise(currentPath);
  return (
    <DetailsMenu className="public-nav-more">
      <summary aria-label="Menu">
        {/* Three bars, because "MENU" in letter-spaced caps read as a heading
            floating in the middle of the header rather than as a control. */}
        <svg aria-hidden="true" viewBox="0 0 20 14" className="nav-burger">
          <path d="M0 1h20M0 7h20M0 13h20" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </summary>
      {/*
        Anchored to the header, not to the button.

        This panel was `position: absolute; right: 0` on a <details> sitting in
        the middle of the header, so a 22rem panel started 22rem to the LEFT of
        a button that was nowhere near the right edge — on a 390px screen the
        search box and every link label were cut off past the left edge of the
        screen. The header's inner container is `relative`, so left/right 0
        here is the width of the shell.
      */}
      <div className="public-nav-more-panel">
        <form action="/search" className="public-nav-search">
          <label className="sr-only" htmlFor="mobile-search">
            Search the research
          </label>
          <input
            id="mobile-search"
            name="q"
            type="search"
            placeholder="ASML, EUV, quartz"
            maxLength={200}
          />
          <button type="submit">Search</button>
        </form>
        {extra.length > 0 && (
          <div className="public-nav-more-group">
            {extra.map((item) => (
              <MenuItem key={item.href} item={item} current={current} />
            ))}
          </div>
        )}
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="public-nav-more-group">
            <p className="public-nav-more-label">{group.label}</p>
            {group.items.map((item) => (
              <MenuItem key={item.href} item={item} current={current} />
            ))}
          </div>
        ))}
        <Link
          href={NAV_ACTION.href}
          aria-current={isCurrent(current, NAV_ACTION.href) ? 'page' : undefined}
          className="public-nav-more-action"
        >
          {NAV_ACTION.label}
        </Link>
      </div>
    </DetailsMenu>
  );
}
