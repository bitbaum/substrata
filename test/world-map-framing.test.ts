/**
 * The atlas world map frames what the reader can see: the part of the canvas
 * between the bar and the sheet (or left of the desktop panel). These pin the
 * two regressions from the 2026-09-25 screenshots — the world in a strip half
 * under the phone sheet, and Russia "framed" as the whole world because its
 * outline crosses the antimeridian.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { feature } from 'topojson-client';
import type { FeatureCollection, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';

import {
  focusTransform,
  homeTransform,
  pathsFor,
  rewound,
  type CountryFeature,
  type View,
} from '../components/portal/world-map-geo';

const topo = JSON.parse(readFileSync('public/geo/countries-50m.json', 'utf8')) as Topology<{
  countries: GeometryCollection;
}>;
const features = (
  feature(topo, topo.objects.countries) as FeatureCollection<
    Geometry,
    { name: string; iso: string }
  >
).features.map((f) => rewound(f as CountryFeature));

// A 390px phone: canvas 390×724, bar to 66px, the half sheet from 318px.
const PHONE = 390;
const phoneHalf: View = { x0: 0, y0: 66, x1: 390, y1: 318 };
const phonePeek: View = { x0: 0, y0: 66, x1: 390, y1: 500 };
const drawn = pathsFor(features, PHONE);
const country = (iso: string) => drawn.countries.find((c) => c.iso === iso)!;

test('the resting world fills the width and sits centred between bar and sheet', () => {
  const t = homeTransform(phonePeek, drawn.frameBounds);
  const [[x0, y0], [x1, y1]] = drawn.frameBounds;
  const [left, top] = t.apply([x0, y0]);
  const [right, bottom] = t.apply([x1, y1]);
  assert.ok(right - left > PHONE * 0.9, `world is ${right - left}px of ${PHONE}`);
  assert.ok(top >= phonePeek.y0 && bottom <= phonePeek.y1, 'world inside the visible part');
  const mid = (top + bottom) / 2;
  assert.ok(Math.abs(mid - (phonePeek.y0 + phonePeek.y1) / 2) < 2, 'vertically centred');
});

test('a country crossing the antimeridian is framed by its main landmass', () => {
  for (const iso of ['ru', 'us']) {
    const [[x0], [x1]] = country(iso).bounds;
    assert.ok(x1 - x0 < PHONE * 0.45, `${iso} spans ${Math.round(x1 - x0)}px`);
  }
});

test('a selected country is zoomed into the part the half sheet leaves open', () => {
  for (const iso of ['ru', 'in', 'cl', 'za', 'nz']) {
    const { bounds } = country(iso);
    const t = focusTransform(phoneHalf, bounds, drawn.frameBounds);
    const [left, top] = t.apply(bounds[0]);
    const [right, bottom] = t.apply(bounds[1]);
    const tol = 2;
    assert.ok(
      left >= phoneHalf.x0 - tol &&
        right <= phoneHalf.x1 + tol &&
        top >= phoneHalf.y0 - tol &&
        bottom <= phoneHalf.y1 + tol,
      `${iso} at ${[left, top, right, bottom].map(Math.round)} is not above the sheet`,
    );
  }
  assert.ok(focusTransform(phoneHalf, country('ru').bounds, drawn.frameBounds).k > 1.2);
});
