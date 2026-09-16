/**
 * The navigation, as data.
 *
 * Seven flat items was too many to hold, and two of them — Science and
 * Research — were indistinguishable from the label alone. The fix is not
 * fewer destinations but fewer decisions: three groups that answer three
 * different questions, and one action.
 *
 *   The map    — what is constrained, who holds it, what governs it, what fixes it
 *   Latest     — what changed, and what we have written about it
 *   About      — how this is made, what the words mean, what we think
 *   Join       — the way in, kept out of the groups because it is a different verb
 *
 * Every item carries a one-line blurb that renders in the menu. That is the
 * information hierarchy: a reader chooses from descriptions, not from nouns
 * they have to guess at.
 *
 * Created: 2026-09-15
 */

export interface NavItem {
  label: string;
  href: string;
  /** Shown under the label in the menu. Say what the reader will find, not what it is called. */
  blurb: string;
  /** Rendered as a small count or status next to the label. */
  badge?: string;
}

export interface NavGroup {
  id: string;
  label: string;
  /** One line describing the group, shown at the top of its panel. */
  blurb: string;
  items: NavItem[];
  /** The one thing worth pointing at inside this group. */
  feature?: { label: string; href: string; blurb: string };
}

export function navGroups(counts: {
  bottlenecks: number;
  organisations: number;
  rules: number;
  solutions: number;
  events: number;
  notes: number;
  calls: number;
  capital: number;
  learn: number;
  bindingNow: number;
}): NavGroup[] {
  return [
    {
      id: 'map',
      label: 'The map',
      blurb: 'Everything standing between here and faster technology, and who holds it.',
      items: [
        {
          label: 'World map',
          href: '/world',
          blurb: 'Every country: recorded policy, organisations, events and gaps.',
        },
        {
          label: 'Chain atlas',
          href: '/atlas',
          blurb: 'See the stages, bottlenecks, companies and evidence together.',
        },
        {
          label: 'Talent',
          href: '/talent',
          blurb: 'The expertise chains need, and how to contribute yours.',
        },
        {
          label: 'Bottlenecks',
          href: '/bottlenecks',
          blurb: 'What has to exist first, and how hard each one is holding things up.',
          badge: String(counts.bottlenecks),
        },
        {
          label: 'Markets',
          href: '/markets',
          blurb: 'The organisations that make the constrained things, and how replaceable each is.',
          badge: String(counts.organisations),
        },
        {
          label: 'Policy',
          href: '/policy',
          blurb: 'Rules that slow or speed building, and who publicly asked for them.',
          badge: String(counts.rules),
        },
        {
          label: 'Science',
          href: '/science',
          blurb: 'What would remove a bottleneck, and how far off it is.',
          badge: String(counts.solutions),
        },
        {
          label: 'Capital',
          href: '/capital',
          blurb: 'Who could fund relief — and where money is not the constraint.',
          badge: String(counts.capital),
        },
      ],
      feature: {
        label: `${counts.bindingNow} binding right now`,
        href: '/bottlenecks?horizon=now',
        blurb: 'The constraints judged to be holding things up today, worst first.',
      },
    },
    {
      id: 'latest',
      label: 'Latest',
      blurb: 'What changed, and what we make of it.',
      items: [
        {
          label: 'Today',
          href: '/',
          blurb: 'The last thirty days in one screen.',
        },
        {
          label: 'Events',
          href: '/events',
          blurb: 'Every dated change to a bottleneck, with the sentence from its source.',
          badge: String(counts.events),
        },
        {
          label: 'Blog & notes',
          href: '/notes',
          blurb: 'Written pieces: what the map implies, and what we got wrong.',
          badge: String(counts.notes),
        },
        {
          label: 'Changelog',
          href: '/changelog',
          blurb: 'What shipped, from the canonical development record.',
        },
      ],
    },
    {
      id: 'about',
      label: 'About',
      blurb: 'How this is made, and what the words mean.',
      items: [
        {
          label: 'Roadmap & vision',
          href: '/development',
          blurb: 'Where Substrata is heading, and what is being built.',
        },
        {
          label: 'Data quality',
          href: '/data',
          blurb: 'Evidence, uncertainty, dates and reproducible exports.',
        },
        {
          label: 'Learn',
          href: '/learn',
          blurb: 'What the words mean and how to read the tables. No prior knowledge needed.',
          badge: String(counts.learn),
        },
        {
          label: 'What this is',
          href: '/about',
          blurb: 'The project, the method, and what it deliberately is not.',
        },
        {
          label: 'What we think',
          href: '/thesis',
          blurb: 'Six claims, each with what would show it is wrong.',
        },
        {
          label: 'Calls',
          href: '/calls',
          blurb: 'Dated predictions with what would settle them, scored in public.',
          badge: String(counts.calls),
        },
        {
          label: 'Open questions',
          href: '/research',
          blurb: 'The research programme: what we are trying to answer, and how.',
        },
        {
          label: 'Data and API',
          href: '/api/map',
          blurb: 'The whole map as JSON, for anyone building on it.',
        },
      ],
    },
  ];
}

/** The action, kept out of the groups. */
export const NAV_ACTION = {
  label: 'Join',
  href: '/join',
  blurb: 'Contribute what you know to an open research project.',
} as const;

/** Flat list of every internal path the navigation points at, for the route test. */
export function navPaths(groups: NavGroup[]): string[] {
  return [
    ...groups.flatMap((group) => [
      ...group.items.map((item) => item.href),
      ...(group.feature ? [group.feature.href] : []),
    ]),
    NAV_ACTION.href,
  ]
    .filter((href) => href.startsWith('/'))
    .map((href) => href.split(/[?#]/)[0]);
}
