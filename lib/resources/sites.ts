/**
 * Producer sites: the USGS facility rows (research/usgs-producers.json) placed
 * where they are (research/producer-places.json, geocoded once from
 * OpenStreetMap by scripts/research/geocode-producers.py).
 *
 * A site is one printed location in one country, with every facility USGS
 * lists there. Its point carries the precision OpenStreetMap could confirm —
 * the facility itself, the nearest town, or only the province — and the page
 * says which, so a dot never claims more than the source does.
 */
import places from '@/research/producer-places.json';
import { facilitiesFor, yearbookCountries, type Facility } from './producers';

export type SitePrecision = 'site' | 'town' | 'region';

interface PlaceRow {
  iso2: string;
  location: string;
  lat: number;
  lon: number;
  precision: SitePrecision;
  query: string;
  matched: string;
}

const FILE = places as unknown as {
  source: string;
  licence: string;
  retrieved: string;
  note: string;
  counts: Record<string, number>;
  places: PlaceRow[];
};

export const SITES_SOURCE = {
  label: FILE.source,
  licence: FILE.licence,
  retrieved: FILE.retrieved,
  note: FILE.note,
  counts: FILE.counts,
};

export const PRECISION_LABEL: Record<SitePrecision, string> = {
  site: 'The facility itself',
  town: 'Nearest named town',
  region: 'Province or state only',
};

export interface Site {
  /** Stable across rebuilds: a hash of the country and the printed location. */
  id: string;
  iso2: string;
  location: string;
  lon: number;
  lat: number;
  precision: SitePrecision;
  /** The place OpenStreetMap matched, to check the dot against. */
  matched: string;
  facilities: Facility[];
  year: string;
  chapter: string;
}

/** djb2, base 36: short, stable, URL-safe. */
function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function siteId(iso2: string, location: string): string {
  return `${iso2}-${hash(`${iso2}|${location}`)}`;
}

const PLACED = new Map(FILE.places.map((p) => [siteId(p.iso2, p.location), p]));

/** Every placed site with at least one facility of this resource. */
export function sitesFor(resource: string): Site[] {
  const out: Site[] = [];
  for (const iso2 of yearbookCountries()) {
    const chapter = facilitiesFor(iso2, resource);
    if (!chapter) continue;
    const byLocation = new Map<string, Facility[]>();
    for (const f of chapter.rows) {
      byLocation.set(f.location, [...(byLocation.get(f.location) ?? []), f]);
    }
    for (const [location, facilities] of byLocation) {
      const id = siteId(iso2, location);
      const p = PLACED.get(id);
      if (!p) continue;
      out.push({
        id,
        iso2,
        location,
        lon: p.lon,
        lat: p.lat,
        precision: p.precision,
        matched: p.matched,
        facilities,
        year: chapter.year,
        chapter: chapter.url,
      });
    }
  }
  return out;
}

/** Facility rows of this resource that have no point yet: the research gap, counted. */
export function unplacedCount(resource: string): number {
  let n = 0;
  for (const iso2 of yearbookCountries()) {
    const chapter = facilitiesFor(iso2, resource);
    for (const f of chapter?.rows ?? []) if (!PLACED.has(siteId(iso2, f.location))) n += 1;
  }
  return n;
}

export function siteById(resource: string, id: string): Site | null {
  return sitesFor(resource).find((s) => s.id === id) ?? null;
}
