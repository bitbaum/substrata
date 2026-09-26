/**
 * Which country is under a pixel of the globe: invert the projection, then
 * test the few countries whose lon/lat box holds the point.
 */
import { geoBounds, geoContains, type GeoProjection } from 'd3-geo';

import type { CountryFeature } from './globe-geo';

export interface Pickable {
  feature: CountryFeature;
  /** lon/lat box; west > east when it crosses the antimeridian. */
  box: [[number, number], [number, number]];
}

export function pickIndex(countries: CountryFeature[]): Pickable[] {
  return countries.map((feature) => ({
    feature,
    box: geoBounds(feature) as [[number, number], [number, number]],
  }));
}

function inBox([[w, s], [e, n]]: Pickable['box'], [lon, lat]: [number, number]): boolean {
  if (lat < s || lat > n) return false;
  return w <= e ? lon >= w && lon <= e : lon >= w || lon <= e;
}

/**
 * The country under a canvas pixel, or null for ocean and the space around
 * the globe. `invert` is the projection's; off the disc it has no answer.
 */
export function pickAt(
  index: Pickable[],
  projection: GeoProjection,
  x: number,
  y: number,
): CountryFeature | null {
  const [cx, cy] = projection.translate();
  const r = projection.scale();
  if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) return null;
  const at = projection.invert?.([x, y]);
  if (!at || !Number.isFinite(at[0]) || !Number.isFinite(at[1])) return null;
  const point: [number, number] = [at[0], at[1]];
  for (const p of index) if (inBox(p.box, point) && geoContains(p.feature, point)) return p.feature;
  return null;
}
