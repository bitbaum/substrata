/**
 * The countries the map draws, by name — read from the same file the browser
 * loads, so the search list and the map can never disagree about what exists.
 */
import world from '@/public/geo/countries-50m.json';

import type { CountryOption } from '@/components/portal/CountryFinder';

interface Geometry {
  properties: { name: string; iso: string };
}

export const MAP_COUNTRIES: CountryOption[] = (
  world as unknown as { objects: { countries: { geometries: Geometry[] } } }
).objects.countries.geometries
  .map((g) => g.properties)
  .filter((p) => p.iso)
  .map((p) => ({ iso: p.iso, name: p.name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const MAP_ISOS = MAP_COUNTRIES.map((c) => c.iso);
