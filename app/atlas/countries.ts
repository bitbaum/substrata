/**
 * A small lookup generated from the same topology the globe loads on demand.
 * Keep the multi-hundred-kilobyte geometry out of the route's server bundle.
 */
import world from '@/public/geo/countries-index.json';

import type { CountryOption } from '@/components/portal/CountryFinder';

export const MAP_COUNTRIES: CountryOption[] = world
  .map(({ iso, name }) => ({ iso, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const MAP_ISOS = MAP_COUNTRIES.map((c) => c.iso);
