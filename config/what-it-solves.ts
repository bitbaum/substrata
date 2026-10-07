/**
 * "What it solves" — the front page's answer to "what is this actually for?"
 *
 * The hero says what the site is and the role doors say where each reader
 * starts. Neither says what problem a visit settles, so a first-time reader
 * had to infer it from feature names like "X-ray" and "pipeline". This is that
 * answer, said plainly: a situation a person or a society is in, then what
 * they can actually find, use, cite or change here, then the one page that
 * does it.
 *
 * Honesty rule — the same one `test/truth.test.ts` enforces on the rest of the
 * site: every `gives` describes something that works on the site today, in
 * the words the page itself uses. Substrata is a research map, not a firm and
 * not an adviser, so nothing here promises an outcome, a forecast or advice,
 * and no count is written into copy (counts go stale; the pages compute them).
 * A roadmap item does not belong here until it ships.
 *
 * Every `href` is a static route from `lib/links.ts`; `test/what-it-solves.test.ts`
 * holds the ids unique and the links to pages that exist.
 */

export interface SolvedProblem {
  id: string;
  /** Who is in the situation, as a short label. */
  who: string;
  /** The situation, in the words of the person in it. */
  problem: string;
  /** What Substrata gives them — true of the site today. */
  gives: string;
  /** The page that does it. A static route. */
  href: string;
  /** The link's words: what happens when it is followed. */
  cta: string;
}

export interface ProblemScale {
  id: 'people' | 'society';
  title: string;
  subtitle: string;
  items: readonly SolvedProblem[];
}

export const WHAT_IT_SOLVES = {
  title: 'What it solves',
  subtitle:
    'Faster technology waits on a short list of physical things: materials, machines, factories, grid connections and the people who run them. Here is what knowing exactly which ones, and how well that is evidenced, does for you and for everyone.',
  cta: {
    lede: 'This map is wrong in places. If you know one of these chains, you can fix it faster than anyone here can, in public and under your own name.',
    primary: { label: 'Fix a row', href: '/join' },
    secondary: { label: 'Ask the research', href: '/chat' },
  },
} as const;

export const PROBLEM_SCALES: readonly ProblemScale[] = [
  {
    id: 'people',
    title: 'For you',
    subtitle: 'A question you might bring, and the page that answers it.',
    items: [
      {
        id: 'holdings',
        who: 'Investors',
        problem: '“I own shares and funds, and I can’t tell what physical things they rest on.”',
        gives:
          'Paste tickers or a CSV. You see which bottlenecks each holding holds or rests on, the sole makers behind them and the countries your weight sits in. Nothing you paste is kept, and none of it is advice.',
        href: '/xray',
        cta: 'X-ray your holdings',
      },
      {
        id: 'plan',
        who: 'Industry teams',
        problem:
          '“Our plan needs something with a long queue, and I need to know how hard it binds.”',
        gives:
          'Each constraint with a dated severity and when it bites, the lead times, backlogs and queues on record, what changed lately and what could relieve it. Every judgement sits next to the sentence that explains it.',
        href: '/for/industry',
        cta: 'Open the industry view',
      },
      {
        id: 'work',
        who: 'Job seekers',
        problem: '“I want work that unblocks progress, but I don’t know which jobs those are.”',
        gives:
          'Open roles at the companies that hold the bottlenecks, grouped by the bottleneck they work on, plus what each kind of work needs and public ways to train into it.',
        href: '/careers',
        cta: 'See where they hire',
      },
      {
        id: 'words',
        who: 'Learners',
        problem:
          '“Everyone talks about chip shortages and grid queues. I don’t know what that means.”',
        gives:
          'Short explainers and a glossary in plain words, written for people who do not work in these industries, including how to read this site.',
        href: '/learn',
        cta: 'Start learning',
      },
      {
        id: 'cite',
        who: 'Writers and researchers',
        problem: '“I need a fact I can cite and data I can reuse, not a hunch.”',
        gives:
          'Every row says whether a person checked its source, and links it when one did. The whole map is one JSON document, series download as CSV, and the code is MIT-licensed.',
        href: '/data',
        cta: 'See what is sourced',
      },
      {
        id: 'relief',
        who: 'Scientists and founders',
        problem: '“I work on something that could ease a constraint. Who else is on it?”',
        gives:
          'For every bottleneck, the research, lab work, pilots and products that could relieve it: who is doing each, and how far along it is.',
        href: '/science/pipeline',
        cta: 'Open the pipeline',
      },
    ],
  },
  {
    id: 'society',
    title: 'For everyone',
    subtitle: 'Problems nobody owns, that a public, checkable map makes smaller.',
    items: [
      {
        id: 'whole-chain',
        who: 'Seeing the system',
        problem: 'Nobody can see the whole chain behind more compute, power or machines.',
        gives:
          'One public board of what has to exist first: why each piece binds, who makes it, what happened to it lately, which rules govern it and what could remove it, each marked by how well it is evidenced.',
        href: '/bottlenecks',
        cta: 'See the bottlenecks',
      },
      {
        id: 'single-points',
        who: 'Resilience',
        problem: 'One maker or one country stops, and nobody asked beforehand what that breaks.',
        gives:
          'Pick a company, a bottleneck or a country and trace the failure one recorded step at a time: which bottlenecks lose a maker, what lies downstream and what the record says about recovery. No guessed dates.',
        href: '/scenarios',
        cta: 'Run a scenario',
      },
      {
        id: 'rules',
        who: 'Public policy',
        problem: 'Rules that speed up or slow down building are argued without knowing who asked.',
        gives:
          'What each instrument does and to which bottleneck, with the date it was fetched and a sentence quoted from the source. A company is named as asking for a rule only where its own document says so.',
        href: '/policy',
        cta: 'Read the rules',
      },
      {
        id: 'money',
        who: 'Funding',
        problem: 'Money goes to problems that money alone will not fix.',
        gives:
          'Who could fund relief for each bottleneck, what each kind of money will not fund, and where funding is not the constraint at all.',
        href: '/capital',
        cta: 'See who could fund it',
      },
      {
        id: 'forecasts',
        who: 'Accountability',
        problem: 'Predictions about technology are made loudly and forgotten quietly.',
        gives:
          'Dated calls, each with the observation that would settle it, scored in public, and the wrong ones stay on the page. The record began in September 2026.',
        href: '/calls',
        cta: 'Read the calls',
      },
      {
        id: 'trust',
        who: 'Trust',
        problem: 'Published research is hard to check, and errors stay where they are.',
        gives:
          'Every dataset is scored against written criteria, with each failing row and its source shown. Anyone can challenge a row in the open, and every fix is a public commit.',
        href: '/data/quality',
        cta: 'See the quality scores',
      },
    ],
  },
];
