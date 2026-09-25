/**
 * Sanctions that name a resource, where the machine-readable registers do not.
 *
 * research/sanctions.json (scripts/research/sanctions.py) carries every EU
 * regime and the OFAC country programs. OFAC's program pages do not break a
 * program into goods, so a US measure on a specific metal is recorded here by
 * hand: one row per measure, the issuing body's own words, the page they are
 * on, and the date. Nothing here without a quote from that page.
 */

export interface ResourceSanction {
  iso2: string;
  resources: string[];
  by: 'US' | 'UK' | 'EU';
  /** The date the measure took effect or was announced, as the source gives it. */
  date: string;
  /** Words from the source page, verbatim. */
  quote: string;
  source: string;
  sourceLabel: string;
  readOn: string;
}

export const RESOURCE_SANCTIONS: readonly ResourceSanction[] = [
  {
    iso2: 'ru',
    resources: ['bauxite', 'copper', 'nickel'],
    by: 'US',
    date: '2024-04-12',
    quote:
      'This new action prohibits the import of Russian-origin aluminum, copper, and nickel into the United States, and limits the use of Russian-origin aluminum, copper, and nickel on global metal exchanges and in over-the-counter derivatives trading.',
    source: 'https://home.treasury.gov/news/press-releases/jy2249',
    sourceLabel:
      'U.S. Treasury, "United States and United Kingdom Take Action to Reduce Russian Revenue from Metals"',
    readOn: '2026-09-25',
  },
];
