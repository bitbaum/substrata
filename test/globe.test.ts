/**
 * The globe's pure parts: which way to turn to face a country (the countries
 * that cross the antimeridian and the ones whose outline includes far-off
 * islands are the ones that go wrong), how far to zoom, the flight the short
 * way round, picking a country under a pixel, and the colour quantisation
 * the map layer hands it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { GeometryCollection, Topology } from 'topojson-specification';

import {
  validateGeographyManifest,
  verifyGeographyResource,
  type GeographyManifest,
  type LicenseRule,
} from '@bitbaum/geo-kit';

import { pickAt, pickIndex, projectionFor } from '@bitbaum/geo-kit/map';

import { cameraFor, focusOf, isCountry, worldFrom } from '../components/portal/globe-geo';
import { NOT_A_NUMBER, mapLayer, shareBin } from '../app/atlas/map-layer';
import { MAP_ISOS } from '../app/atlas/countries';

const topo = JSON.parse(readFileSync('public/geo/countries-50m.json', 'utf8')) as Topology<{
  countries: GeometryCollection;
}>;
const manifest = JSON.parse(readFileSync('public/geo/manifest.json', 'utf8')) as GeographyManifest;
const world = worldFrom(topo);
const country = (iso: string) => {
  const f = world.countries.find((c) => c.id === iso);
  assert.ok(f, `${iso} is on the globe`);
  return f;
};

test('the on-demand map resource has explicit sources, viewpoint, and matching integrity metadata', async () => {
  const licensePolicy: readonly LicenseRule[] = [
    { spdx: 'LicenseRef-Natural-Earth-Public-Domain', requiresAttribution: false },
    { spdx: 'ODbL-1.0', requiresAttribution: true },
  ];
  assert.deepEqual(
    validateGeographyManifest(manifest, {
      licensePolicy,
      maxResources: 4,
      maxByteSize: 512 * 1024,
    }),
    [],
  );
  const [resource] = manifest.resources;
  assert.ok(resource);
  assert.equal(resource.viewpointKey, 'natural-earth-de-facto');
  assert.deepEqual(resource.sourceIds, ['natural-earth-50m', 'world-countries-5-1-0']);
  const data = await verifyGeographyResource(
    resource,
    new Uint8Array(readFileSync('public/geo/countries-50m.json')),
  );
  assert.equal(
    (data as unknown as typeof topo).objects.countries.geometries.length,
    resource.featureCount,
  );

  const index = JSON.parse(readFileSync('public/geo/countries-index.json', 'utf8')) as {
    iso: string;
    name: string;
  }[];
  assert.deepEqual(
    index.map((country) => country.iso).sort(),
    [...MAP_ISOS].sort(),
    'small finder index agrees with the map features',
  );
  assert.equal(new Set(MAP_ISOS).size, MAP_ISOS.length, 'country codes are unique');
});

// The globe's geometry, movement, culling, picking and painting are the fleet
// renderer's (@bitbaum/geo-kit/map) and are tested there, on the same Natural
// Earth data. What is tested here is Substrata's side: its countries keyed by
// ISO code, framed by their mainland, picked by code.

// A 390px phone: the strip between the bar and the half sheet.
const phone = { x0: 0, y0: 66, x1: 390, y1: 318 };

test('every country on the map is keyed by its ISO code; the few without one are drawn, never picked', () => {
  const codes = world.countries.map((c) => c.id).filter(isCountry);
  assert.deepEqual([...codes].sort(), [...MAP_ISOS].sort());
  const unlisted = world.countries.filter((c) => !isCountry(c.id));
  assert.ok(unlisted.length > 0 && unlisted.length < 10, `${unlisted.length} without a code`);
  assert.deepEqual(
    world.coarse.features.map((f) => f.id),
    world.countries.map((c) => c.id),
    'the coarse world painted in motion is the same countries in the same order',
  );
});

test('a country is faced by its mainland: Russia, the lower 48, France in Europe, Fiji at the date line', () => {
  const ru = focusOf(country('ru'));
  assert.ok(ru.center[0] > 60 && ru.center[0] < 120 && ru.reach < 45, JSON.stringify(ru));
  const us = focusOf(country('us'));
  assert.ok(us.center[0] > -110 && us.center[0] < -85 && us.reach < 30, JSON.stringify(us));
  assert.ok(focusOf(country('fr')).reach < 10);
  assert.ok(Math.abs(focusOf(country('fj')).center[0]) > 175);
  assert.ok(cameraFor(country('ru')).k < cameraFor(country('in')).k);
});

test('a tap on a country picks it by its code', () => {
  const index = pickIndex(world.countries.filter((c) => isCountry(c.id)));
  const land: Record<string, [number, number]> = {
    ru: [100, 62],
    us: [-100, 40],
    fj: [178, -17.8],
    ch: [8.2, 46.8],
  };
  for (const [iso, point] of Object.entries(land)) {
    const proj = projectionFor(phone, cameraFor(country(iso)));
    const [x, y] = proj(point)!;
    assert.equal(pickAt(index, proj, x, y)?.id, iso, `tap on ${iso}`);
  }
});

test('shares fall into five steps; the boundaries go up, never down', () => {
  assert.equal(shareBin(0), 1);
  assert.equal(shareBin(0.0099), 1);
  assert.equal(shareBin(0.01), 2);
  assert.equal(shareBin(0.05), 3);
  assert.equal(shareBin(0.1), 4);
  assert.equal(shareBin(0.249), 4);
  assert.equal(shareBin(0.25), 5);
  assert.equal(shareBin(1), 5);
});

test('colour means a quantity: nothing is shaded without one', () => {
  assert.deepEqual(mapLayer(undefined, 'production', MAP_ISOS).bins, {});
  // Uranium was the example until the WNA table measured it (2026-10-23).
  const neon = mapLayer('neon', 'production', MAP_ISOS);
  assert.deepEqual(neon.bins, {}, 'neon has no country table, so no shade');
  assert.match(neon.legend.note ?? '', /No quantity to shade/);
  assert.ok(Object.keys(neon.labels).length > 0, 'the hover still says where it is listed');
});

test('a shaded layer: numbers on the ramp, words hatched, missing countries left plain', () => {
  const layer = mapLayer('gallium', 'production', MAP_ISOS);
  assert.equal(layer.bins.cn, 5, 'China makes nearly all the gallium');
  const bins = Object.values(layer.bins);
  assert.ok(bins.every((b) => (b >= 1 && b <= 5) || b === NOT_A_NUMBER));
  assert.ok(Object.keys(layer.bins).length < MAP_ISOS.length / 2, 'most countries are not listed');
  assert.equal(layer.otherwise, 'Not listed by USGS');
  // USGS withholds US lithium output: a word, hatched, never a step on the ramp.
  const lithium = mapLayer('lithium', 'production', MAP_ISOS);
  assert.equal(lithium.bins.us, NOT_A_NUMBER);
  assert.ok(
    lithium.legend.keys.some((k) => k.bin === NOT_A_NUMBER),
    'the legend explains the hatch',
  );
  assert.ok(layer.legend.scale?.length === 5);
});

test('a shaded layer names its top producers ON the globe, largest first, never the plain map', () => {
  // 2026-10-12: a painted globe said how much, somewhere — the reader had to
  // hover each country to learn WHERE. The top band is now labelled in place.
  const lithium = mapLayer('lithium', 'production', MAP_ISOS);
  assert.ok(lithium.callouts.length > 0 && lithium.callouts.length <= 8);
  assert.equal(lithium.callouts[0].iso, 'au', 'Australia mines the most lithium');
  assert.ok(
    lithium.callouts.some((c) => c.iso === 'cl'),
    'Chile is in the top band',
  );
  for (const c of lithium.callouts) assert.match(c.text, /%$/, 'a share, when shares exist');
  for (const c of lithium.callouts) assert.ok(lithium.bins[c.iso] >= 4, `${c.iso} is top band`);
  assert.deepEqual(mapLayer(undefined, 'production', MAP_ISOS).callouts, []);
  assert.deepEqual(mapLayer('neon', 'production', MAP_ISOS).callouts, []);
});
