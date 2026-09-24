/**
 * Who comes here, and the view each one lands on.
 *
 * The site grew by feature — X-ray, exposure, filings, series, scenarios,
 * science, careers, learning — and each is useful to someone, but a reader
 * had to know which feature they needed before they could find it. A role
 * view starts from the reader instead: five doors, each opening on a page
 * composed from the existing screens, with every section linking to the full
 * one. Nothing here computes anything; the views only choose and order.
 *
 * Read by the homepage chooser, the header's "For you" group
 * (config/site-nav.ts) and `app/for/[role]`.
 */
export type AudienceId = 'equities' | 'commodities' | 'industry' | 'jobs' | 'learning';

export interface Audience {
  id: AudienceId;
  /** First person, as the reader would say it. */
  iAm: string;
  /** Menu label: a noun for the reader. */
  label: string;
  /** Page title. */
  title: string;
  /** One sentence: what this view answers. Also the menu hint. */
  hint: string;
  /** What the view is built from, in the order it shows them. */
  serves: readonly string[];
}

export const AUDIENCES: readonly Audience[] = [
  {
    id: 'equities',
    iAm: 'I trade equities',
    label: 'Equity investors',
    title: 'What your holdings rest on, and what just moved.',
    hint: 'X-ray a portfolio, see listed holders under pressure, and read their latest SEC filings.',
    serves: ['Portfolio X-ray', 'Listed holders under pressure', 'SEC filings', 'Scenarios'],
  },
  {
    id: 'commodities',
    iAm: 'I trade commodities',
    label: 'Commodity traders',
    title: 'Which numbers moved, and which rules could move them next.',
    hint: 'Series with the biggest latest moves, export controls and trade rules, and what-if scenarios.',
    serves: ['Biggest moves in the series', 'Export controls and trade rules', 'Scenarios'],
  },
  {
    id: 'industry',
    iAm: 'I work in the industry',
    label: 'Industry teams',
    title: 'The constraints on your plan: how hard they bind, how long they last.',
    hint: 'For strategy, procurement and engineering: the bottleneck board, lead times and what could relieve them.',
    serves: ['Bottleneck board', 'Lead times', 'What changed', 'Science pipeline'],
  },
  {
    id: 'jobs',
    iAm: "I'm looking for work",
    label: 'Job seekers',
    title: 'Where the bottlenecks are hiring.',
    hint: 'Open roles at the companies that hold the bottlenecks, grouped by the bottleneck they work on.',
    serves: ['Newest roles', 'Hiring by bottleneck', 'Skills and training'],
  },
  {
    id: 'learning',
    iAm: "I'm learning",
    label: 'Learners',
    title: 'How the machine that makes machines works, in plain words.',
    hint: 'Explainers and a glossary, training paths for career changers, and a technology to start from.',
    serves: ['Explainers', 'Follow one technology', 'Training paths'],
  },
];

export function audienceHref(id: AudienceId): string {
  return `/for/${id}`;
}

export function audienceById(id: string): Audience | undefined {
  return AUDIENCES.find((a) => a.id === id);
}
