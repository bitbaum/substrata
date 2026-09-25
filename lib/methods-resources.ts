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
} as const satisfies Record<string, Method>;
