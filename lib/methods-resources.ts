/**
 * Methods for the per-country resource figures (lib/resources/*), spread into
 * METHODS in lib/methods.ts. Share, HHI and reserves-to-production live there
 * already and are reused; these are the ones the resource tables added.
 */
import type { Method } from './methods';

export const RESOURCE_METHODS = {
  'world-rank': {
    title: 'World rank',
    formula:
      'Position of a country when the countries USGS lists individually are sorted by the same column, largest first; equal values share a rank.',
    explanation:
      'Only countries with their own row in the USGS table are ranked. Producers USGS folds into "Other countries" are not ranked, and a withheld (W) figure cannot be ranked, so the United States is often missing from a ranking it would place in. Rank 3 means third among those listed, not third in the world with certainty.',
    code: ['lib/resources/choropleth.ts', 'research/usgs-mcs.json'],
  },
  'production-change': {
    title: 'Change on the year before',
    formula:
      'Latest year ÷ the year before − 1, same country, same column of the same table (USGS or EIA).',
    explanation:
      'USGS publishes the latest year as an estimate (marked e) and revises it the following February, so a change computed on it is provisional. No change is shown when either year is withheld, missing or zero.',
    code: ['lib/resources/country.ts'],
  },
  'resource-significance': {
    title: 'Which resources a country is listed for first',
    formula:
      "A country's resources are ordered by its largest share of world output on any production column of each table (e.g. palladium within PGMs).",
    explanation:
      'An ordering, not a score: it says where the country weighs most in world supply on the published figures. Resources with reserves but no production sort last; resources the directory names but no table lists are shown apart, never as zero.',
    code: ['lib/resources/country.ts'],
  },
} as const satisfies Record<string, Method>;
