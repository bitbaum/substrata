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

import { geoDistance } from 'd3-geo';

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
import { centreOf, horizonOf, visible } from '../components/portal/globe-cull';
import { coast, dragged, flight } from '../components/portal/globe-motion';
import { basisOf, pack, project, traceLine, traceRing } from '../components/portal/globe-trace';
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
  assert.ok(zoomFor(30) > 1.1 && zoomFor(30) < 1.3);
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

test('the coarse world painted in motion is the same countries, lighter, still meeting at borders', () => {
  const count = (g: unknown): number =>
    Array.isArray(g) ? (typeof g[0] === 'number' ? 1 : g.reduce((n, x) => n + count(x), 0)) : 0;
  const full = world.countries.reduce(
    (n, c) => n + count((c.geometry as { coordinates: unknown }).coordinates),
    0,
  );
  const coarse = world.coarse.countries.reduce(
    (n, c) => n + count((c.geometry as { coordinates: unknown }).coordinates),
    0,
  );
  assert.deepEqual(
    world.coarse.countries.map((c) => c.properties.iso),
    world.countries.map((c) => c.properties.iso),
    'same countries in the same order, so one paint serves both',
  );
  assert.ok(coarse < full * 0.45, `${coarse} of ${full} vertices`);
  // Russia's coarse outline still covers its mainland, not the whole ocean.
  const ru = world.coarse.countries.find((c) => c.properties.iso === 'ru')!;
  assert.ok(focusOf(ru).reach < 45);
  // A shared border stays shared: every Swiss vertex in the coarse world lies
  // on the full-detail outline of Switzerland or one of its neighbours.
  const ch = world.coarse.countries.find((c) => c.properties.iso === 'ch')!;
  const fullPoints = new Set(
    world.countries
      .filter((c) => ['ch', 'fr', 'de', 'at', 'it', 'li'].includes(c.properties.iso))
      .flatMap(
        (c) =>
          JSON.stringify((c.geometry as { coordinates: unknown }).coordinates).match(
            /-?[\d.]+,-?[\d.]+/g,
          ) ?? [],
      ),
  );
  const chPoints =
    JSON.stringify((ch.geometry as { coordinates: unknown }).coordinates).match(
      /-?[\d.]+,-?[\d.]+/g,
    ) ?? [];
  assert.ok(chPoints.length > 10 && chPoints.every((p) => fullPoints.has(p)));
});

test('the far side is culled, and nothing with a vertex in view ever is', () => {
  const canvas = { w: 390, h: 724 };
  const cameras = [
    { center: [0, 0] as [number, number], k: 1 },
    { center: [178, -17] as [number, number], k: 1 },
    { center: [100, 60] as [number, number], k: 1.5 },
    { center: [-100, 40] as [number, number], k: 4 },
    { center: [8, 47] as [number, number], k: 7 },
  ];
  for (const cam of cameras) {
    const proj = projectionFor(phone, cam);
    const horizon = horizonOf(proj, canvas);
    const centre = centreOf(proj);
    assert.ok(
      Math.abs(centre[0] - cam.center[0]) < 1e-6 && Math.abs(centre[1] - cam.center[1]) < 1e-6,
    );
    let culled = 0;
    world.countries.forEach((c, i) => {
      const shown = visible(world.caps[i], centre, horizon);
      if (!shown) culled++;
      // In view, decided without horizonOf: on the front hemisphere and
      // projected inside the canvas rectangle.
      const inView = JSON.stringify(c.geometry)
        .match(/-?[\d.e-]+,-?[\d.e-]+/g)!
        .some((p) => {
          const point = p.split(',').map(Number) as [number, number];
          if (geoDistance(centre, point) >= Math.PI / 2) return false;
          const [x, y] = proj(point)!;
          return x >= 0 && x <= canvas.w && y >= 0 && y <= canvas.h;
        });
      if (inView) assert.ok(shown, `${c.properties.name} is in view from ${cam.center} but culled`);
    });
    assert.ok(culled > world.countries.length * 0.15, `only ${culled} culled from ${cam.center}`);
  }
  // The whole disc fits at rest: the horizon is the hemisphere. Zoomed in, it shrinks.
  assert.equal(horizonOf(projectionFor(phone, HOME), canvas), 90);
  assert.ok(horizonOf(projectionFor(phone, { center: [8, 47], k: 7 }), canvas) < 60);
});

test('the fast projection draws exactly what d3 draws, on the front of the globe', () => {
  for (const cam of [
    HOME,
    { center: [178, -17] as [number, number], k: 3 },
    { center: [-100, 60] as [number, number], k: 1.4 },
  ]) {
    const proj = projectionFor(phone, cam);
    const [cx, cy] = proj.translate();
    const b = basisOf(cam.center, cx, cy, proj.scale());
    for (const [lon, lat] of [
      [0, 0],
      [30, 18],
      [179.9, -16.5],
      [-179.9, -16.9],
      [-100, 40],
      [100, 62],
      [8, 47],
    ]) {
      const [x, y, depth] = project(b, lon, lat);
      if (depth <= 0) continue;
      const [dx, dy] = proj([lon, lat])!;
      assert.ok(
        Math.abs(x - dx) < 1e-6 && Math.abs(y - dy) < 1e-6,
        `${lon},${lat} from ${cam.center}`,
      );
    }
  }
});

test('behind the globe a ring is pulled onto the limb and a line breaks', () => {
  const b = basisOf([0, 0], 100, 100, 50);
  const calls: string[] = [];
  const at: [number, number][] = [];
  const pen = {
    moveTo: (x: number, y: number) => (calls.push('M'), at.push([x, y])),
    lineTo: (x: number, y: number) => (calls.push('L'), at.push([x, y])),
    closePath: () => calls.push('Z'),
  };
  // A ring from the front (lon 60) round the back (lon 150) and back again.
  traceRing(
    pen,
    pack([
      [60, 0],
      [150, 0],
      [150, 10],
      [60, 10],
    ]),
    b,
  );
  assert.deepEqual(calls, ['M', 'L', 'L', 'L', 'Z']);
  for (const [x, y] of at.slice(1, 3))
    assert.ok(Math.abs(Math.hypot(x - 100, y - 100) - 50) < 1e-9, 'a back vertex sits on the limb');
  calls.length = 0;
  traceLine(
    pen,
    pack([
      [60, 0],
      [80, 0],
      [150, 0],
      [170, 0],
      [-80, 0],
      [-60, 0],
    ]),
    b,
  );
  assert.deepEqual(calls, ['M', 'L', 'M', 'L'], 'the line lifts behind the globe and resumes');
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
