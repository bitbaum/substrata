/**
 * Chrome, as data. One research list, two shells, and nine destinations a
 * reader can hold in their head.
 *
 * Public header and desk sidebar share the same link objects, so a destination
 * cannot exist in one and vanish in the other. Homepage stays a public page
 * even when signed in. Every other signed-in page keeps the desk sidebar, so
 * clicking a left-panel item does not throw the reader into a different shell.
 *
 * The header is GROUPED, and was grouped once before: the README has described
 * "three menu groups and one action, because seven flat items was more than a
 * reader could hold" since `components/portal/Megamenu.tsx` existed. That file
 * was deleted in 7f59e09 and the README was never told. What replaced it was a
 * flat list of nine uppercase links that wrapped onto two rows at 1440px and
 * was hidden entirely below 1100px — so a tablet got a lone "MENU" in an empty
 * header, and a desktop got a header twice as tall as it should be.
 *
 * The grouping lives here rather than in a component this time, which is what
 * makes it hard to lose again: a link is declared once in `LINK`, and both the
 * header groups and the desk list are built from those objects. `test/nav.test.ts`
 * holds the two halves together.
 *
 * Every destination carries one line saying what is behind it, so a reader
 * chooses from what they will find rather than from a noun. Those lines are
 * taken from each page's own description — never written fresh here, because a
 * second description is a second thing to keep true.
 */

export interface NavLink {
  label: string;
  href: string;
  /** One line, in the page's own words. Shown in the menu, never on the page. */
  hint: string;
}

export interface NavGroup {
  label: string;
  items: readonly NavLink[];
}

/** Every public destination, declared once. */
const LINK = {
  map: {
    label: 'Map',
    href: '/atlas',
    hint: 'Trace one bottleneck from producers to technologies, or open any country.',
  },
  bottlenecks: {
    label: 'Bottlenecks',
    href: '/bottlenecks',
    hint: 'What has to exist before more compute, power or machines — and how hard each binds.',
  },
  markets: {
    label: 'Markets',
    href: '/markets',
    hint: 'Who makes the constrained things, graded by how hard each would be to replace.',
  },
  exposure: {
    label: 'Exposure',
    href: '/exposure',
    hint: 'Every bottleneck, who holds it, and where their shares trade — with a CSV download.',
  },
  policy: {
    label: 'Policy',
    href: '/policy',
    hint: 'The rules that speed up or slow down building, and who publicly asked for them.',
  },
  science: {
    label: 'Science',
    href: '/science',
    hint: 'What could remove each bottleneck, and how far off it is.',
  },
  capital: {
    label: 'Capital',
    href: '/capital',
    hint: 'Who could fund relief — and where money is not the constraint at all.',
  },
  news: {
    label: 'News',
    href: '/events',
    hint: 'What happened to each bottleneck, dated and sourced, tightening or loosening.',
  },
  notes: {
    label: 'Notes',
    href: '/notes',
    hint: 'Written pieces: what the map implies, and where the evidence falls short.',
  },
  changelog: {
    label: 'Changelog',
    href: '/changelog',
    hint: 'Progress from the development profile. The project is in beta.',
  },
  about: {
    label: 'About',
    href: '/about',
    hint: 'What this is, who makes it, and what it deliberately is not.',
  },
  learn: {
    label: 'Learn',
    href: '/learn',
    hint: 'What the terms mean, for people who do not work in these industries.',
  },
  talent: {
    label: 'Talent',
    href: '/talent',
    hint: 'The expertise needed to ramp a factory or connect a grid, made visible.',
  },
  roadmap: {
    label: 'Roadmap',
    href: '/roadmap',
    hint: 'Plans from the development profile, with what is done and what is not.',
  },
  join: {
    label: 'Join',
    href: '/join',
    hint: 'This map is wrong in places. If you know one of these chains, fix it.',
  },
} satisfies Record<string, NavLink>;

/** The header, grouped. Three groups is the whole menu; nothing hides below them. */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: 'The map',
    items: [LINK.map, LINK.bottlenecks, LINK.markets, LINK.policy, LINK.science, LINK.capital],
  },
  { label: 'Latest', items: [LINK.news, LINK.notes, LINK.changelog] },
  { label: 'About', items: [LINK.about, LINK.learn, LINK.talent, LINK.roadmap] },
];

/**
 * The one thing in the header that asks for something.
 *
 * It sits outside the groups on purpose: a contribution is not a destination
 * to browse, and burying it in a dropdown is how an invitation stops working.
 */
export const NAV_ACTION: NavLink = LINK.join;

/** The research, in the order a reader should be able to fall into it. */
export const RESEARCH_NAV: readonly NavLink[] = [
  LINK.map,
  LINK.bottlenecks,
  LINK.markets,
  LINK.policy,
  LINK.science,
  LINK.capital,
  LINK.learn,
  LINK.news,
  LINK.talent,
];

export const PUBLIC_NAV: readonly NavLink[] = RESEARCH_NAV;

export const DESK_NAV: readonly NavLink[] = [
  { label: 'Desk', href: '/account', hint: 'Your saved research and follows.' },
  // A working screen rather than a place to browse, so it lives with the desk;
  // the public reaches it from Markets.
  LINK.exposure,
  ...RESEARCH_NAV,
  { label: 'Inbox', href: '/review', hint: 'Contributions waiting on a reviewer.' },
];

export const FOOTER_NAV: readonly NavLink[] = [
  LINK.about,
  LINK.notes,
  LINK.changelog,
  LINK.roadmap,
  LINK.join,
];

/** Whether a rendered path sits inside a destination, so a group can mark itself. */
export function isCurrent(current: string, href: string): boolean {
  return current === href || current.startsWith(`${href}/`);
}

export function navPaths(): string[] {
  return [...PUBLIC_NAV, ...DESK_NAV, ...FOOTER_NAV, ...NAV_GROUPS.flatMap((g) => g.items)]
    .map((item) => item.href.split(/[?#]/)[0])
    .filter((href, i, all) => all.indexOf(href) === i);
}
