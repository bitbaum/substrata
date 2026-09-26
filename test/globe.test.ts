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
  HOME,
  MAX_TILT,
  cameraFor,
  disc,
  focusOf,
  projectionFor,
  worldFrom,
  wrapLon,
  zoomFor,
  type View,
} from '../components/portal/globe-geo';
import { coast, dragged, flight } from '../components/portal/globe-motion';
import { pickAt, pickIndex } from '../components/portal/globe-pick';
import { NOT_A_NUMBER, mapLayer, shareBin } from '../app/atlas/map-layer';
import { MAP_ISOS } from '../app/atlas/countries';

const topo = JSON.parse(readFileSync('public/geo/countries-50m.json', 'utf8')) as Topology<{
  countries: GeometryCollection;
}>;
const world = worldFrom(topo);
const country = (iso: string) => {
  const f = world.countries.find((c) => c.properties.iso === iso);
  assert.ok(f, `${iso} is on the globe`);
  return f;
};

// A 390px phone: the strip between the bar and the half sheet.
const phone: View = { x0: 0, y0: 66, x1: 390, y1: 318 };

test('the globe sits centred in the visible part, with room for its glow', () => {
  const d = disc(phone);
  assert.equal(d.cx, 195);
  assert.equal(d.cy, 192);
  assert.ok(d.radius < (318 - 66) / 2, 'inside the strip');
  assert.ok(d.radius > (318 - 66) / 2 - 30, 'but not shrunk for nothing');
});

test('Russia is faced by its mainland, not the Bering Strait or the Atlantic', () => {
  const { center, reach } = focusOf(country('ru'));
  assert.ok(center[0] > 60 && center[0] < 120, `lon ${center[0]}`);
  assert.ok(center[1] > 50 && center[1] < 70, `lat ${center[1]}`);
  assert.ok(reach < 45, `reach ${reach}`);
});

test('the United States is faced by the lower 48, not the Pacific between Alaska and Hawaii', () => {
  const { center, reach } = focusOf(country('us'));
  assert.ok(center[0] > -110 && center[0] < -85, `lon ${center[0]}`);
  assert.ok(center[1] > 32 && center[1] < 45, `lat ${center[1]}`);
  assert.ok(reach < 30, `reach ${reach}: Hawaii and Alaska would make it ~60°`);
});

test('France is framed in Europe, not stretched to Guiana; Norway without Svalbard', () => {
  const fr = focusOf(country('fr'));
  assert.ok(fr.reach < 10, `France reach ${fr.reach}`);
  const no = focusOf(country('no'));
  assert.ok(no.center[1] < 68 && no.reach < 15, `Norway ${JSON.stringify(no)}`);
});

test('Fiji, astride the date line, is faced at the date line and zoomed in close', () => {
  const { center, reach } = focusOf(country('fj'));
  assert.ok(Math.abs(center[0]) > 175, `lon ${center[0]}`);
  assert.ok(center[1] < -15 && center[1] > -20, `lat ${center[1]}`);
  assert.ok(reach < 3, `reach ${reach}`);
  assert.ok(cameraFor(country('fj')).k > 5);
});

test('zoom fits the country: large ones stay near the whole globe, small ones stop at a limit', () => {
  assert.equal(zoomFor(90), 1);
  assert.ok(zoomFor(30) > 1.3 && zoomFor(30) < 1.6);
  assert.equal(zoomFor(0.01), 7);
  assert.ok(cameraFor(country('ru')).k < cameraFor(country('in')).k);
});

test('a flight takes the short way across the date line', () => {
  const f = flight({ center: [170, -15], k: 3 }, { center: [-170, -14], k: 3 });
  const mid = f.at(0.5).center[0];
  assert.ok(Math.abs(mid) > 175, `mid-flight at lon ${mid}, not round the world`);
  assert.deepEqual(
    f.at(1).center.map((v) => Math.round(v)),
    [-170, -14],
  );
});

test('a long flight pulls back mid-way; a short one does not', () => {
  const long = flight({ center: [0, 0], k: 3 }, { center: [150, 20], k: 3 });
  assert.ok(long.at(0.5).k < 2.5);
  const short = flight({ center: [0, 0], k: 3 }, { center: [10, 0], k: 3 });
  assert.ok(Math.abs(short.at(0.5).k - 3) < 0.01);
  assert.ok(long.duration > short.duration);
});

test('a drag turns the land under the finger with it, and north stays within the tilt', () => {
  const r = disc(phone).radius;
  const right = dragged(HOME, 50, 0, r);
  assert.ok(right.center[0] < HOME.center[0], 'dragging right brings the west into view');
  const down = dragged(HOME, 0, 5000, r);
  assert.equal(down.center[1], MAX_TILT);
  assert.equal(wrapLon(190), -170);
  assert.equal(wrapLon(-180), 180);
});

test('a flick coasts in its direction and comes to rest', () => {
  let step = coast(HOME, { vx: 1, vy: 0 }, 16, 200);
  assert.ok(step.camera.center[0] < HOME.center[0], 'keeps turning the way it was flicked');
  let frames = 1;
  while (step.spin && frames < 1000) {
    step = coast(step.camera, step.spin, 16, 200);
    frames++;
  }
  assert.equal(step.spin, undefined);
  assert.ok(frames > 20 && frames < 200, `rests after ${frames} frames`);
});

test('a tap picks the country under it, and nothing off the disc or on the far side', () => {
  const index = pickIndex(world.countries.filter((c) => c.properties.iso));
  // A point on land in each (Fiji's centre of mass is sea between its islands).
  const land: Record<string, [number, number]> = {
    ru: [100, 62],
    us: [-100, 40],
    fj: [178, -17.8],
    in: [78, 22],
    ch: [8.2, 46.8],
  };
  for (const [iso, point] of Object.entries(land)) {
    const proj = projectionFor(phone, cameraFor(country(iso)));
    const [x, y] = proj(point)!;
    assert.equal(pickAt(index, proj, x, y)?.properties.iso, iso, `tap on ${iso}`);
  }
  const proj = projectionFor(phone, { center: [0, 0], k: 1 });
  assert.equal(pickAt(index, proj, 2, 70), null, 'the corner of the canvas is space');
  // Australia is on the far side from [0, 0]: behind the globe, not pickable.
  const behind = proj([135, -25]);
  assert.ok(!behind || pickAt(index, proj, behind[0], behind[1])?.properties.iso !== 'au');
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
  const uranium = mapLayer('uranium', 'production', MAP_ISOS);
  assert.deepEqual(uranium.bins, {}, 'uranium has no country table, so no shade');
  assert.match(uranium.legend.note ?? '', /No quantity to shade/);
  assert.ok(Object.keys(uranium.labels).length > 0, 'the hover still says where it is listed');
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
