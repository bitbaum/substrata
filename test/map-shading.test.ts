import assert from 'node:assert/strict';
import test from 'node:test';

import { MAP_ISOS } from '../app/atlas/countries';
import { NOT_A_NUMBER } from '../app/atlas/map-layer';
import { SHADINGS, shadedLayer, shadingOf } from '../app/atlas/map-shading';
import { restrictionsOn } from '../lib/resources/restrictions';

const ids = (layer: ReturnType<typeof shadedLayer>) =>
  (layer.legend.measures ?? []).map((m) => m.id);

test('a URL picks a shading, and anything else falls back to production', () => {
  assert.equal(shadingOf('trend'), 'trend');
  assert.equal(shadingOf('reserves'), 'reserves');
  assert.equal(shadingOf(undefined), 'production');
  assert.equal(shadingOf('trade'), 'production', 'an unsourced shading is never drawn');
  assert.equal(SHADINGS[0].id, 'production');
});

test('nickel offers every sourced shading, and the current one is marked', () => {
  const layer = shadedLayer('nickel', 'reserves', MAP_ISOS);
  assert.deepEqual(ids(layer), ['production', 'reserves', 'trend', 'risk']);
  assert.equal(layer.legend.measures?.find((m) => m.current)?.id, 'reserves');
});

test('the trend is a one-year change from the same USGS table, on the five-step ramp', () => {
  const layer = shadedLayer('nickel', 'trend', MAP_ISOS);
  assert.match(layer.legend.title, /change \d{4}–\d{4}/);
  assert.equal(layer.legend.scale?.length, 5);
  const bins = Object.values(layer.bins);
  assert.ok(bins.length > 0);
  assert.ok(bins.every((b) => (b >= 1 && b <= 5) || b === NOT_A_NUMBER));
  for (const [iso, b] of Object.entries(layer.bins))
    if (b !== NOT_A_NUMBER) assert.match(layer.labels[iso], /^[+−]?\d/, `${iso} reads as a change`);
});

test('the risk layer counts OECD export restrictions and never calls absence safe', () => {
  const resource = 'nickel';
  const layer = shadedLayer(resource, 'risk', MAP_ISOS);
  const countries = new Set(restrictionsOn(resource).map((r) => r.iso2));
  assert.ok(countries.size > 0, 'the inventory records nickel measures');
  assert.equal(Object.keys(layer.bins).length, countries.size);
  assert.match(layer.otherwise ?? '', /None recorded/);
  assert.match(layer.legend.note ?? '', /not the same as unrestricted/);
});

test('a resource without a country table offers no trend, and a missing shading falls back', () => {
  const uranium = shadedLayer('uranium', 'trend', MAP_ISOS);
  assert.ok(!ids(uranium).includes('trend'));
  assert.deepEqual(uranium.bins, {}, 'no quantity, no shade');
});
