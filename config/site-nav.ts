/**
 * Chrome, as data: one shell for every page, signed in or not.
 *
 * The left panel had grown to seventeen flat rows — the desk, three working
 * screens, nine research links, careers, talent, freshness and an inbox — and
 * the public header carried a second, different grouping of the same pages.
 * Two menus for one site, and neither could be held in the head.
 *
 * This follows the shell Loki and OrangeCat settled on after the same problem,
 * rather than inventing a third answer:
 *
 * - Five sections, grouped by what a reader is doing. Only the section holding
 *   the current page opens by itself, so the panel shows five headings and a
 *   handful of rows, not seventeen. (`components/shell/`)
 * - Personal things — desk, settings, the reviewer inbox, sign out — live in
 *   the account menu in the top bar, never mixed into the research list.
 * - The long tail (reader views, data pages, the project's own pages) is one
 *   keystroke away in the command palette, ⌘K, which also searches every
 *   bottleneck and company.
 * - On a phone: four tabs and "More", which opens the same sections.
 *
 * Every link is declared once in `LINK` and every surface is built from these
 * lists, so a page cannot be in one menu and missing from another.
 * `test/nav.test.ts` holds the lists to the contract; the README table is the
 * sidebar and is checked against it.
 *
 * Every destination carries one line saying what is behind it, taken from the
 * page's own description rather than written fresh here.
 */

import { AUDIENCES, audienceHref } from './audiences';

export type NavIcon =
  'home' | 'explore' | 'markets' | 'science' | 'careers' | 'news' | 'bottlenecks' | 'map' | 'more';

export interface NavLink {
  label: string;
  href: string;
  /** One line, in the page's own words. Shown in menus, never on the page. */
  hint: string;
}

export interface NavSection {
  id: string;
  label: string;
  icon: NavIcon;
  /** What the section is for, as the question a reader brings to it. */
  question: string;
  items: readonly NavLink[];
}

/** Every destination, declared once. */
const LINK = {
  home: {
    label: 'Home',
    href: '/',
    hint: 'The bottlenecks on the path to transformative technology, and where to start.',
  },
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
  policy: {
    label: 'Policy',
    href: '/policy',
    hint: 'The rules that speed up or slow down building, and who publicly asked for them.',
  },
  capital: {
    label: 'Capital',
    href: '/capital',
    hint: 'Who could fund relief — and where money is not the constraint at all.',
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
  xray: {
    label: 'X-ray',
    href: '/xray',
    hint: 'Paste holdings and see which bottlenecks each one holds and rests on.',
  },
  scenarios: {
    label: 'Scenarios',
    href: '/scenarios',
    hint: 'What if a company, a bottleneck or a country fails? Traced one recorded step at a time.',
  },
  science: {
    label: 'Science',
    href: '/science',
    hint: 'What could remove each bottleneck, and how far off it is.',
  },
  pipeline: {
    label: 'Pipeline',
    href: '/science/pipeline',
    hint: 'The research, lab work, pilots and products that could relieve each bottleneck.',
  },
  learn: {
    label: 'Learn',
    href: '/learn',
    hint: 'What the terms mean, for people who do not work in these industries.',
  },
  careers: {
    label: 'Careers',
    href: '/careers',
    hint: 'Open roles at the companies that hold the bottlenecks, and how to train into them.',
  },
  careerPaths: {
    label: 'Skills and training',
    href: '/careers/paths',
    hint: 'What each kind of work needs, what postings ask for, and public ways to train into it.',
  },
  careerCompanies: {
    label: 'Where companies hire',
    href: '/careers/companies',
    hint: 'Every company in the directory and where its open roles are published.',
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
  calls: {
    label: 'Calls',
    href: '/calls',
    hint: 'Dated predictions with the observation that would settle each one, scored in public.',
  },
  talent: {
    label: 'Talent',
    href: '/talent',
    hint: 'The expertise needed to ramp a factory or connect a grid, made visible.',
  },
  data: {
    label: 'Data quality',
    href: '/data',
    hint: 'What has a source, what is still a lead, and what is a dated judgement.',
  },
  quality: {
    label: 'Quality scores',
    href: '/data/quality',
    hint: 'Every dataset scored against written criteria, with each failing row, its source and a way to report it.',
  },
  freshness: {
    label: 'Freshness',
    href: '/data/freshness',
    hint: 'Every feed and dataset: when it last ran, how often it should, and whether it is late.',
  },
  ask: {
    label: 'Ask',
    href: '/chat',
    hint: 'Ask a question of the research and get an answer with its sources.',
  },
  about: {
    label: 'About',
    href: '/about',
    hint: 'What this is, who makes it, and what it deliberately is not.',
  },
  changelog: {
    label: 'Changelog',
    href: '/changelog',
    hint: 'Progress from the development profile. The project is in beta.',
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

export const HOME_LINK: NavLink = LINK.home;

/**
 * The sidebar: five sections, grouped by what a reader is doing.
 * Five headings is the whole panel until one opens.
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    id: 'explore',
    label: 'Explore',
    icon: 'explore',
    question: 'What has to exist, where it is made, and what governs it?',
    items: [LINK.bottlenecks, LINK.map, LINK.policy, LINK.capital],
  },
  {
    id: 'markets',
    label: 'Markets',
    icon: 'markets',
    question: 'Who holds each bottleneck, and what does it mean for a portfolio?',
    items: [LINK.markets, LINK.exposure, LINK.xray, LINK.scenarios],
  },
  {
    id: 'science',
    label: 'Science',
    icon: 'science',
    question: 'What could relieve each bottleneck, and how far off is it?',
    items: [LINK.science, LINK.pipeline, LINK.learn],
  },
  {
    id: 'careers',
    label: 'Careers',
    icon: 'careers',
    question: 'Where are the bottlenecks hiring, and how do you train into them?',
    items: [LINK.careers, LINK.careerPaths, LINK.careerCompanies],
  },
  {
    id: 'news',
    label: 'News',
    icon: 'news',
    question: 'What changed, and what does it imply?',
    items: [LINK.news, LINK.notes],
  },
];

/** Phone bottom bar: four destinations, then "More" opens every section. */
export const MOBILE_TABS: readonly (NavLink & { icon: NavIcon })[] = [
  { ...LINK.bottlenecks, icon: 'bottlenecks' },
  { ...LINK.map, icon: 'map' },
  { ...LINK.markets, icon: 'markets' },
  { ...LINK.news, icon: 'news' },
];

/** The one thing in the top bar that asks for something. */
export const NAV_ACTION: NavLink = LINK.join;

/** Personal pages. The account menu only; never in the research list. */
export const ACCOUNT_NAV = {
  desk: { label: 'Desk', href: '/account', hint: 'Your saved research, follows and leads.' },
  settings: {
    label: 'Settings',
    href: '/account/settings',
    hint: 'What your desk shows, how often it updates, and your own AI key.',
  },
  inbox: { label: 'Inbox', href: '/review', hint: 'Contributions waiting on a reviewer.' },
} satisfies Record<string, NavLink>;

/** One view per reader (config/audiences.ts). Homepage chooser and palette. */
export const READER_VIEWS: readonly NavLink[] = AUDIENCES.map((a) => ({
  label: `For ${a.label.toLowerCase()}`,
  href: audienceHref(a.id),
  hint: a.hint,
}));

/** The project's own pages: footer, the "More" sheet and the palette. */
export const FOOTER_NAV: readonly NavLink[] = [
  LINK.about,
  LINK.notes,
  LINK.changelog,
  LINK.roadmap,
  LINK.join,
];

/** Reached from the palette and from the pages that cite them. */
export const PALETTE_EXTRA: readonly NavLink[] = [
  LINK.ask,
  LINK.calls,
  LINK.talent,
  LINK.data,
  LINK.quality,
  LINK.freshness,
];

/** Every research destination in the sidebar, in order. */
export const RESEARCH_NAV: readonly NavLink[] = NAV_SECTIONS.flatMap((s) => s.items);
export const PUBLIC_NAV: readonly NavLink[] = RESEARCH_NAV;

/** Whether a rendered path sits inside a destination. */
export function isCurrent(current: string, href: string): boolean {
  if (href === '/') return current === '/';
  return current === href || current.startsWith(`${href}/`);
}

/**
 * The most specific link a path sits in, so /careers/paths marks "Skills and
 * training" and not "Careers" as well.
 */
export function currentHref(current: string, links: readonly NavLink[]): string | null {
  let best: string | null = null;
  for (const link of links) {
    if (isCurrent(current, link.href) && (!best || link.href.length > best.length))
      best = link.href;
  }
  return best;
}

export function sectionFor(current: string): NavSection | undefined {
  const href = currentHref(current, RESEARCH_NAV);
  return href ? NAV_SECTIONS.find((s) => s.items.some((i) => i.href === href)) : undefined;
}

export function navPaths(): string[] {
  return [
    HOME_LINK,
    ...RESEARCH_NAV,
    ...Object.values(ACCOUNT_NAV),
    ...READER_VIEWS,
    ...FOOTER_NAV,
    ...PALETTE_EXTRA,
  ]
    .map((item) => item.href.split(/[?#]/)[0])
    .filter((href, i, all) => all.indexOf(href) === i);
}
