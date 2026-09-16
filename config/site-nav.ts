/**
 * Chrome, as data. One research list, two shells.
 *
 * Public header and desk sidebar share RESEARCH_NAV so a destination cannot
 * exist in one and vanish in the other. Homepage stays a public page even
 * when signed in. Every other signed-in page keeps the desk sidebar, so
 * clicking a left-panel item does not throw the reader into a different shell.
 */

export interface NavLink {
  label: string;
  href: string;
}

/** The research, in the order a reader should be able to fall into it. */
export const RESEARCH_NAV: readonly NavLink[] = [
  { label: 'Map', href: '/atlas' },
  { label: 'Bottlenecks', href: '/bottlenecks' },
  { label: 'Markets', href: '/markets' },
  { label: 'Policy', href: '/policy' },
  { label: 'Science', href: '/science' },
  { label: 'Capital', href: '/capital' },
  { label: 'Learn', href: '/learn' },
  { label: 'News', href: '/events' },
  { label: 'Talent', href: '/talent' },
];

export const PUBLIC_NAV: readonly NavLink[] = RESEARCH_NAV;

export const DESK_NAV: readonly NavLink[] = [
  { label: 'Desk', href: '/account' },
  ...RESEARCH_NAV,
  { label: 'Inbox', href: '/review' },
];

export const FOOTER_NAV: readonly NavLink[] = [
  { label: 'About', href: '/about' },
  { label: 'Notes', href: '/notes' },
  { label: 'Changelog', href: '/changelog' },
  { label: 'Roadmap', href: '/roadmap' },
  { label: 'Join', href: '/join' },
];

export function navPaths(): string[] {
  return [...PUBLIC_NAV, ...DESK_NAV, ...FOOTER_NAV]
    .map((item) => item.href.split(/[?#]/)[0])
    .filter((href, i, all) => all.indexOf(href) === i);
}
