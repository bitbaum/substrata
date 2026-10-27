/**
 * The company universe's counts, spread into METHODS in lib/methods.ts.
 */
import type { Method } from './methods';

export const UNIVERSE_METHODS = {
  'universe-count': {
    title: 'Companies in the universe',
    formula:
      'Count of companies admit() admits today: tier A (a hand-verified chain role) plus tier B (a cited theme, a cited size figure over its floor, and a registry identifier).',
    explanation:
      'Each evidence row carries a source URL, the quoted row or record, the day it was read and the date it is for; a row past its freshness window is set aside before the tests run, so a company leaves on the day its last fresh evidence goes stale. Counts by theme overlap: a company held by a robotics fund and a uranium fund is in both. Countries are a registry’s legal address where one is cited, else the listing venue.',
    code: [
      'config/universe-themes.ts',
      'lib/universe/admit.ts',
      'lib/universe/store.ts',
      'research/universe.json',
    ],
  },
} satisfies Record<string, Method>;
