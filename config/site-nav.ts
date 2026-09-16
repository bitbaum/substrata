/**
 * Chrome, as data. Two shells, two lists.
 *
 * Public: a SpaceX-thin bar. Four jobs — read the map, see what changed, ask,
 * sign in. Everything else is a page the map or the footer can reach.
 *
 * Desk: the signed-in app. Sidebar only here. Public megamenus do not follow
 * a reader into their dashboard.
 *
 * Created: 2026-09-15. Split into public vs desk 2026-09-16.
 */

export interface NavLink {
  label: string;
  href: string;
}

/** Header on every public page. Order is the information hierarchy. */
export const PUBLIC_NAV: readonly NavLink[] = [
  { label: 'Map', href: '/atlas' },
  { label: 'News', href: '/events' },
  { label: 'Ask', href: '/chat' },
];

/** Sidebar on /account and /review only. */
export const DESK_NAV: readonly NavLink[] = [
  { label: 'Desk', href: '/account' },
  { label: 'Ask', href: '/chat' },
  { label: 'Map', href: '/atlas' },
  { label: 'News', href: '/events' },
  { label: 'Inbox', href: '/review' },
];

/** Sparse footer. Not a sitemap. */
export const FOOTER_NAV: readonly NavLink[] = [
  { label: 'About', href: '/about' },
  { label: 'Changelog', href: '/changelog' },
  { label: 'Roadmap', href: '/roadmap' },
];

export function navPaths(): string[] {
  return [...PUBLIC_NAV, ...DESK_NAV, ...FOOTER_NAV]
    .map((item) => item.href.split(/[?#]/)[0])
    .filter((href, i, all) => all.indexOf(href) === i);
}
