/**
 * Names looked for on purpose and NOT admitted, because no source we could
 * open supports one of the three tests. Saying where we looked is what makes
 * "not on the list" mean something. A row leaves this file the day an
 * evidence row for the missing test lands (research/universe.json or
 * config/candidates/universe.json); test/universe.test.ts fails while a name
 * is both here and admitted.
 */
import type { Considered } from '@/lib/universe/types';

export const CONSIDERED: readonly Considered[] = [
  {
    name: 'Figure AI',
    looked: [
      'Thematic fund holdings read here (private: no fund files it)',
      'SEC EDGAR company tickers (no registrant)',
      'figure.ai news page for a stated round or valuation (not opened from the build sandbox)',
    ],
    why: 'Identity and theme are easy to state but no materiality figure (a round or valuation) was opened and quoted. A stated round from the company or a lead investor admits it.',
    on: '2026-10-25',
  },
  {
    name: 'Unitree Robotics',
    looked: [
      'Thematic fund holdings read here (not held)',
      'Wikidata (rate-limited from the sandbox on 2026-10-25)',
    ],
    why: 'No fund read here holds it and no size figure was opened and quoted. A listing prospectus or exchange filing would carry identity and size together.',
    on: '2026-10-25',
  },
  {
    name: 'TerraPower',
    looked: [
      'DOE Advanced Reactor Demonstration Program page (renders its content by script; no text to quote)',
      'NRC advanced reactor applicant page (same)',
      'Thematic fund holdings read here (private: no fund files it)',
    ],
    why: 'Theme is clear (an ARDP awardee building Natrium) but the pages that say so could not be read as text, and no round or valuation was quoted. A DOE award notice or a stated round admits it.',
    on: '2026-10-25',
  },
];
