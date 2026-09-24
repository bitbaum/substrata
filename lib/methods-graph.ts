/**
 * Methods for the numbers on /xray and /scenarios. Kept apart from
 * lib/methods.ts so that file stays one job under its size ceiling; it
 * spreads these in, and /data renders them like any other.
 */
import type { Method } from './methods';

export const GRAPH_METHODS = {
  'xray-rails': {
    title: 'Portfolio X-ray: rails a holding touches',
    formula:
      'For each resolved holding: the bottlenecks its companies hold (maker, capacity or part supplier), the ones a filing says they need or sell into, and everything upstream of a held or needed rail through recorded "needs" rows.',
    explanation:
      'Tickers resolve only against research/listings.json; a parent listing brings in every subsidiary the directory records under it. Upstream walks start from rails a company makes or runs, never from a part it supplies, and only follow rows in config/substrata-dependencies.ts, each with its source sentence. A rail the corpus does not record is absent, which is not the same as not exposed.',
    code: [
      'lib/xray/portfolio.ts',
      'lib/xray/holding.ts',
      'lib/xray/resolve.ts',
      'lib/dependencies.ts',
      'config/substrata-dependencies.ts',
    ],
  },
  'xray-weight': {
    title: 'Portfolio X-ray: share of weight on a rail',
    formula:
      'Sum of the weights of the holdings that touch a rail, divided by the sum of the weights of all resolved holdings. With no weights given, every holding counts equally.',
    explanation:
      'It says how much of the pasted portfolio rests on the rail by any recorded route — holding it, needing it, or upstream of what it needs. It is not revenue exposure: a company that touches a rail once counts as fully on it.',
    code: ['lib/xray/portfolio.ts'],
  },
  'xray-country': {
    title: 'Portfolio X-ray: concentration by country',
    formula:
      'For each country: the share of portfolio weight on a rail whose every recorded maker operates there, and the share on a rail with at least one recorded maker there. Part suppliers are not makers.',
    explanation:
      'Makers are counted from their recorded operating jurisdictions. A bottleneck with no maker rows is placed by its own recorded location. The first column is the one that matters: a rail whose every maker sits in one country is a single-country dependency for everything downstream of it.',
    code: ['lib/xray/portfolio.ts', 'lib/bottleneck-makers.ts'],
  },
  'scenario-propagation': {
    title: 'Scenario propagation',
    formula:
      'Direct hits: bottlenecks where the failed node is a maker, a part supplier or the location. Makers wholly inside it are lost; makers also operating elsewhere are partly affected; the rest remain. Downstream: every bottleneck that needs a hit one, transitively, through recorded rows. Exposed: holders of hit and downstream bottlenecks and companies a filing says need or sell into them.',
    explanation:
      'A part supplier is never counted as a remaining maker: Zeiss and Trumpf do not make EUV scanners. "Partly affected" means the row records operations inside and outside the country, not how much of either. Downstream means an input is disrupted, not that the dependent stops; the corpus has no substitution or inventory data to say more.',
    code: [
      'lib/scenario/propagate.ts',
      'lib/scenario/exposed.ts',
      'lib/bottleneck-makers.ts',
      'config/substrata-dependencies.ts',
    ],
  },
  'scenario-output-share': {
    title: 'Scenario: share of recorded world output in the failed country',
    formula:
      'The country’s recorded annual production divided by the recorded world total for the same year and unit, from config/substrata-quantities.ts (USGS).',
    explanation:
      'Only for materials with published figures. The figure counts what the source counts (primary refined gallium, mined rare-earth oxide), which may be broader or narrower than the bottleneck; the row says what it describes.',
    code: ['lib/scenario/recovery.ts', 'lib/quantities.ts', 'config/substrata-quantities.ts'],
  },
} as const satisfies Record<string, Method>;
