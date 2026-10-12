/**
 * Checks on the producer sites the globe draws (research/producer-places.json):
 * every Yearbook location accounted for, no dot in another country, every dot
 * traceable to the GeoNames entry it came from, and every one joined back to a
 * facility in the Yearbook file.
 */
import { geoContains } from 'd3-geo';
import type { GeometryCollection, Topology } from 'topojson-specification';

import topology from '@/public/geo/countries-50m.json';
import places from '@/research/producer-places.json';
import producers from '@/research/usgs-producers.json';
import { worldFrom } from '@/components/portal/globe-geo';
import { judge, type CheckResult } from './types';

const ATLAS = '/atlas?view=world';

export function placeChecks(): CheckResult[] {
  const world = worldFrom(topology as unknown as Topology<{ countries: GeometryCollection }>);
  const byIso = new Map(world.countries.map((c) => [c.properties.iso, c]));
  const printed = new Set(
    producers.countries.flatMap((c) => c.facilities.map((f) => `${c.iso2}|${f.location}`)),
  );
  const accounted = new Set(
    [...places.places, ...places.unresolved].map((p) => `${p.iso2}|${p.location}`),
  );
  const locations = [...printed].filter((key) => key.split('|')[1].trim());
  return [
    judge(
      {
        dataset: 'producer-places',
        criterion: 'completeness',
        check: 'producer-places/accounted',
        label: 'Every facility location is placed or listed as unresolved',
      },
      locations,
      (key) =>
        accounted.has(key)
          ? null
          : { row: key.replace('|', ': '), problem: 'neither placed nor listed', link: ATLAS },
    ),
    judge(
      {
        dataset: 'producer-places',
        criterion: 'correctness',
        check: 'producer-places/own-country',
        label: 'No point lands inside another country',
      },
      places.places,
      (p) => {
        const own = byIso.get(p.iso2);
        if (own && geoContains(own, [p.lon, p.lat])) return null;
        // Offshore at 1:50m is a coastal plant; inside a neighbour is a wrong match.
        const other = world.countries.find((c) => geoContains(c, [p.lon, p.lat]));
        return other || !own
          ? {
              row: `${p.iso2}: ${p.location.slice(0, 60)}`,
              problem: own ? `lands in ${other!.properties.name}` : 'country not on the map',
              link: ATLAS,
            }
          : null;
      },
    ),
    judge(
      {
        dataset: 'producer-places',
        criterion: 'provenance',
        check: 'producer-places/geonames-entry',
        label: 'Every point names its GeoNames entry and states its precision',
      },
      places.places,
      (p) =>
        p.geonameid > 0 &&
        p.feature &&
        p.matched &&
        ['site', 'town', 'region'].includes(p.precision)
          ? null
          : {
              row: `${p.iso2}: ${p.location.slice(0, 60)}`,
              problem: 'no GeoNames entry or precision',
              link: `https://www.geonames.org/${p.geonameid}`,
            },
    ),
    judge(
      {
        dataset: 'producer-places',
        criterion: 'consistency',
        check: 'producer-places/joins',
        label: 'Every point joins back to a facility in the Yearbook file',
      },
      places.places,
      (p) =>
        printed.has(`${p.iso2}|${p.location}`)
          ? null
          : {
              row: `${p.iso2}: ${p.location.slice(0, 60)}`,
              problem: 'no Yearbook row',
              link: ATLAS,
            },
    ),
  ];
}
