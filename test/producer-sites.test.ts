/**
 * Producer sites on the globe: every dot is in its own country, says how
 * precise it is, and joins back to the USGS rows it stands for — and the
 * mistakes the first geocoding passes made stay fixed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { geoContains } from 'd3-geo';
import type { GeometryCollection, Topology } from 'topojson-specification';

import { worldFrom } from '../components/portal/globe-geo';
import { siteById, siteId, sitesFor, unplacedCount } from '../lib/resources/sites';

const topo = JSON.parse(readFileSync('public/geo/countries-50m.json', 'utf8')) as Topology<{
  countries: GeometryCollection;
}>;
const world = worldFrom(topo);
const FILE = JSON.parse(readFileSync('research/producer-places.json', 'utf8')) as {
  licence: string;
  counts: Record<string, number>;
  places: {
    iso2: string;
    location: string;
    lat: number;
    lon: number;
    precision: string;
    matched: string;
  }[];
};

const at = (needle: string) => FILE.places.find((p) => p.location.includes(needle));

test('no dot lands inside another country', () => {
  const byIso = new Map(world.countries.map((c) => [c.properties.iso, c]));
  let inside = 0;
  for (const p of FILE.places) {
    const own = byIso.get(p.iso2);
    assert.ok(own, `${p.iso2} is on the map`);
    if (geoContains(own.geometry, [p.lon, p.lat])) {
      inside += 1;
      continue;
    }
    // A coastal plant can sit just offshore at 1:50m. In a neighbour, never.
    const other = world.countries.find((c) => geoContains(c.geometry, [p.lon, p.lat]));
    assert.equal(other, undefined, `${p.location} (${p.iso2}) lands in ${other?.properties.iso}`);
  }
  assert.ok(inside / FILE.places.length > 0.95, `${inside}/${FILE.places.length} inside`);
});

test('every dot states its precision and its source', () => {
  assert.match(FILE.licence, /CC BY 4\.0/);
  for (const p of FILE.places) {
    assert.ok(['site', 'town', 'region'].includes(p.precision), p.location);
    assert.ok(p.matched.length > 1, `${p.location} names what it matched`);
    assert.ok(Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180, p.location);
  }
  assert.equal(FILE.counts.placed, FILE.places.length);
});

test('a province named in the address holds the point', () => {
  // Two villages called Yangquan and Pingan in Zhejiang once vouched for each other.
  assert.ok(Math.abs(at('Shanxi, Yangquan')!.lat - 38) < 1.5, 'Yangquan is in Shanxi');
  // A town that shares a name with a mine elsewhere.
  assert.ok(at('Potrerillos smelter')!.lat < -25, 'Potrerillos is in Atacama, not Coquimbo');
  assert.ok(at('Milpillas Mine')!.lat > 28, 'Milpillas is in Sonora, not Jalisco');
  assert.ok(at('Santa Cruz nickel')!.lat > 15, 'Santa Cruz, Zambales, is not Manila');
  assert.match(at('Sichuan, Jinchuan, Yelonggou')!.matched, /Sichuan/);
});

test('"N km north of X" is N km north of X, and a distance from a province is no point', () => {
  const at100 = at('100 km north of Ravensthorpe')!;
  const at2 = at('2 km north of Ravensthorpe')!;
  assert.ok(at100.lat - at2.lat > 0.8, 'the 100 km site is about 0.9° further north');
  assert.match(at100.matched, /^100 km north of Ravensthorpe/);
  assert.equal(at('250 kilometers north of Conakry')?.precision ?? 'town', 'town');
});

test('a row that spans two provinces is left out, not pinned to one', () => {
  assert.equal(at('onshore and offshore Bangka Belitung Islands and offshore Kundur'), undefined);
});

test('sites join back to their USGS rows, with stable ids', () => {
  const lithium = sitesFor('lithium');
  assert.ok(lithium.length > 30, `${lithium.length} lithium sites`);
  assert.ok(lithium.some((s) => s.iso2 === 'au') && lithium.some((s) => s.iso2 === 'cl'));
  assert.ok(unplacedCount('lithium') < lithium.length / 5, 'most lithium rows are placed');
  const ids = new Set(lithium.map((s) => s.id));
  assert.equal(ids.size, lithium.length, 'ids are unique');
  for (const s of lithium) {
    assert.ok(s.facilities.length > 0 && s.facilities.every((f) => f.resource === 'lithium'));
    assert.equal(s.id, siteId(s.iso2, s.location), 'an id is its country and printed location');
  }
  const one = lithium[0];
  assert.deepEqual(siteById('lithium', one.id)?.location, one.location);
  assert.equal(siteById('lithium', 'xx-0'), null);
});
