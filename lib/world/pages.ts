/**
 * Which countries have a profile page at /world/<iso2>.
 *
 * A page is earned by having something to say: a directory row of resources,
 * a USGS or EIA table that lists the country, a measure in the OECD
 * inventory, a policy page, or a company that operates there. The set is
 * computed once here and read by the route's static params, the country
 * entity source and the link test, so the three cannot drift — a link to a
 * country that has no page is a failing test, not a 404. Anything else on
 * the map still opens as a sheet over the globe, which `countryHref` falls
 * back to.
 */
import { COUNTRIES } from '@/config/substrata-countries';
import { COUNTRY_RESOURCES } from '@/config/substrata-resources';
import { WORLD_PATHS } from '@/config/world-paths';
import { POLICY_PAGES } from '@/config/substrata-policy';
import { MARKET_PARTICIPANTS } from '@/lib/participants';
import { restrictingCountries } from '@/lib/resources/restrictions';
import { chapters, countryRows } from '@/lib/resources/usgs';

const ISO2 = /^[a-z]{2}$/;

let cache: Set<string> | null = null;

function build(): Set<string> {
  const set = new Set<string>();
  for (const row of COUNTRY_RESOURCES) set.add(row.iso2.toLowerCase());
  for (const c of chapters()) for (const r of countryRows(c)) if (r.iso2) set.add(r.iso2);
  for (const id of restrictingCountries()) set.add(id);
  for (const id of POLICY_PAGES) set.add(id);
  for (const p of MARKET_PARTICIPANTS) for (const j of p.jurisdictions) set.add(j.toLowerCase());
  // The EU is a jurisdiction with a policy page, not a country on the map.
  return new Set([...set].filter((id) => ISO2.test(id) && id !== 'eu').sort());
}

export function countryPages(): string[] {
  cache ??= build();
  return [...cache];
}

export function hasCountryPage(iso2: string): boolean {
  cache ??= build();
  return cache.has(iso2.toLowerCase());
}

/** The profile when there is one, otherwise the country's sheet on the globe. */
export function countryHref(iso2: string, resource?: string): string {
  const id = iso2.toLowerCase();
  if (hasCountryPage(id)) return `/world/${id}`;
  const query = new URLSearchParams({ view: 'world', country: id });
  if (resource) query.set('resource', resource);
  return `/atlas?${query.toString()}`;
}

const REGION_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

/**
 * The display name: the map's, else the index's, else the ISO register's
 * (a company's jurisdiction or an OECD exporter can be a place the map has
 * no path for — Barbados, Singapore), else the code.
 */
export function countryNameOf(iso2: string): string {
  const id = iso2.toLowerCase();
  const fromMap =
    WORLD_PATHS.find((p) => p.iso2 === id)?.name ?? COUNTRIES.find((c) => c.iso2 === id)?.name;
  if (fromMap) return fromMap;
  try {
    const name = REGION_NAMES.of(id.toUpperCase());
    return name && name !== id.toUpperCase() ? name : id.toUpperCase();
  } catch {
    return id.toUpperCase();
  }
}
