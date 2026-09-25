/**
 * The world map's geometry: loading the countries once, projecting them to a
 * box, and the zoom transform that frames the world or one country in it.
 * Pure functions apart from the one cached fetch, so WorldMap.tsx stays about
 * interaction.
 */
import {
  geoArea,
  geoBounds,
  geoEqualEarth,
  geoPath,
  type GeoPath,
  type GeoPermissibleObjects,
} from 'd3-geo';
import { zoomIdentity, type ZoomTransform } from 'd3-zoom';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';

/** Natural Earth 1:50m, built by scripts/geo/build-world-50m.mjs. */
const GEO_URL = '/geo/countries-50m.json';

export type CountryFeature = Feature<Geometry, { name: string; iso: string }>;

let loading: Promise<CountryFeature[]> | null = null;

/**
 * d3-geo is spherical: a ring wound the "wrong" way encloses the rest of the
 * globe, so one bad polygon floods the ocean with that country's colour.
 * Simplification leaves a few such rings; a polygon covering more than a
 * hemisphere is one of them, and reversing its rings puts it right.
 */
export function rewound(f: CountryFeature): CountryFeature {
  const fix = (rings: Position[][]) => {
    const area = geoArea({ type: 'Polygon', coordinates: rings });
    return area > 2 * Math.PI ? rings.map((ring) => [...ring].reverse()) : rings;
  };
  const g = f.geometry;
  if (g.type === 'Polygon') return { ...f, geometry: { ...g, coordinates: fix(g.coordinates) } };
  if (g.type === 'MultiPolygon')
    return { ...f, geometry: { ...g, coordinates: g.coordinates.map(fix) } };
  return f;
}

export function loadCountries(): Promise<CountryFeature[]> {
  loading ??= fetch(GEO_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`map data: ${r.status}`);
      return r.json() as Promise<Topology<{ countries: GeometryCollection }>>;
    })
    .then((topo) => {
      const fc = feature(topo, topo.objects.countries) as FeatureCollection<
        Geometry,
        { name: string; iso: string }
      >;
      return fc.features.map(rewound);
    })
    .catch((error: unknown) => {
      loading = null; // let the next mount retry
      throw error;
    });
  return loading;
}

const SPHERE: GeoPermissibleObjects = { type: 'Sphere' };
/**
 * What the fit frames: the inhabited band, 58°S to 84°N, edge to edge. Points,
 * not a polygon — on a sphere a polygon's edges are great circles, and a
 * "rectangle" through the antimeridian is not the band it looks like.
 */
const LONS = Array.from({ length: 73 }, (_, i) => -180 + i * 5);
const LATS = Array.from({ length: 29 }, (_, i) => -58 + i * 5).concat(84);
const FRAME: GeoPermissibleObjects = {
  type: 'MultiPoint',
  coordinates: [
    ...LONS.flatMap((lon) => [
      [lon, -58],
      [lon, 84],
    ]),
    ...LATS.flatMap((lat) => [
      [-180, lat],
      [180, lat],
    ]),
  ],
};

/**
 * The part of the canvas nothing floats over — below the bar, above the sheet
 * and the legend, left of the panel — in canvas pixels. Measured from the DOM
 * (map-view.ts), so it is right at every width and every sheet snap.
 */
export interface View {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type Bounds = [[number, number], [number, number]];

function box(view: View) {
  const w = Math.max(view.x1 - view.x0, 1);
  const h = Math.max(view.y1 - view.y0, 1);
  return { ...view, w, h, cx: view.x0 + w / 2, cy: view.y0 + h / 2 };
}

/**
 * One projection per canvas width: the band edge to edge across the whole
 * canvas. Where the world sits in the visible part is the zoom transform's
 * job, so a sheet rising or a panel opening never re-projects 240 paths.
 */
export function projectionFor(width: number) {
  const pad = Math.min(24, width * 0.04);
  const projection = geoEqualEarth().fitWidth(Math.max(width - pad * 2, 1), FRAME);
  const [[x0, y0]] = geoPath(projection).bounds(FRAME);
  const [tx, ty] = projection.translate();
  projection.translate([tx - x0 + pad, ty - y0]);
  return projection;
}

/**
 * What to frame when a country is picked. Russia's Chukotka tip and the
 * Aleutians cross the antimeridian, so their outline's projected bounds span
 * the whole map and "fit Russia" framed the world, centred on the Atlantic.
 * A crossing country is framed by the side of the line that holds most of it.
 */
function focusBounds(f: CountryFeature, path: GeoPath, whole: Bounds, width: number): Bounds {
  if (whole[1][0] - whole[0][0] < width * 0.45) return whole;
  const [[lon0, lat0], [lon1, lat1]] = geoBounds(f);
  if (lon0 <= lon1) return whole; // genuinely wide, not wrapped
  const [w, e] = 180 - lon0 >= lon1 + 180 ? [lon0, 180] : [-180, lon1];
  const steps = 8;
  const points: Position[] = [];
  for (let i = 0; i <= steps; i++) {
    const lon = w + ((e - w) * i) / steps;
    const lat = lat0 + ((lat1 - lat0) * i) / steps;
    points.push([lon, lat0], [lon, lat1], [w, lat], [e, lat]);
  }
  return path.bounds({ type: 'MultiPoint', coordinates: points }) as Bounds;
}

export function pathsFor(features: CountryFeature[], width: number) {
  const path = geoPath(projectionFor(width));
  return {
    sphere: path(SPHERE) ?? '',
    countries: features.map((f) => {
      const bounds = path.bounds(f) as Bounds;
      return {
        iso: f.properties.iso,
        name: f.properties.name,
        d: path(f) ?? '',
        bounds: focusBounds(f, path, bounds, width),
      };
    }),
    frameBounds: path.bounds(FRAME) as Bounds,
  };
}

export const MAX_ZOOM = 12;

function centreOn(view: View, x: number, y: number, k: number): ZoomTransform {
  const b = box(view);
  return zoomIdentity.translate(b.cx - x * k, b.cy - y * k).scale(k);
}

/** The scale at which the whole band fits the visible part, with a margin. */
export function homeScale(view: View, frameBounds: Bounds): number {
  const b = box(view);
  const pad = Math.min(24, b.w * 0.04);
  const [[x0, y0], [x1, y1]] = frameBounds;
  return Math.min((b.w - pad * 2) / (x1 - x0), (b.h - pad * 2) / (y1 - y0));
}

/**
 * The resting view: the whole world, as wide as the visible part allows,
 * centred in it. On a phone that is the full width between the bar and the
 * sheet; beside the desktop panel it is the canvas left of it.
 */
export function homeTransform(view: View, frameBounds: Bounds): ZoomTransform {
  const [[x0, y0], [x1, y1]] = frameBounds;
  return centreOn(view, (x0 + x1) / 2, (y0 + y1) / 2, homeScale(view, frameBounds));
}

/**
 * Frame one country in the visible part: large ones fit (never smaller than
 * the whole world), small ones stop at a readable zoom.
 */
export function focusTransform(view: View, bounds: Bounds, frameBounds: Bounds): ZoomTransform {
  const b = box(view);
  const [[x0, y0], [x1, y1]] = bounds;
  const fit = Math.min((b.w * 0.6) / Math.max(x1 - x0, 1), (b.h * 0.6) / Math.max(y1 - y0, 1));
  const k = Math.max(homeScale(view, frameBounds), Math.min(6, fit));
  return clampToView(view, frameBounds, centreOn(view, (x0 + x1) / 2, (y0 + y1) / 2, k));
}

/**
 * Keep empty ocean out of the view: where the world is larger than the
 * visible part it fills it edge to edge, where it is smaller it is centred.
 * Without this, Russia centred beside the desktop panel left the top half of
 * the canvas above the Arctic.
 */
export function clampToView(view: View, frameBounds: Bounds, t: ZoomTransform): ZoomTransform {
  const b = box(view);
  const [[fx0, fy0], [fx1, fy1]] = frameBounds;
  const axis = (lo: number, hi: number, v0: number, v1: number, shift: number) => {
    const size = (hi - lo) * t.k;
    if (size <= v1 - v0) return (v0 + v1) / 2 - ((lo + hi) / 2) * t.k;
    return Math.min(v0 - lo * t.k, Math.max(v1 - hi * t.k, shift));
  };
  const x = axis(fx0, fx1, b.x0, b.x1, t.x);
  const y = axis(fy0, fy1, b.y0, b.y1, t.y);
  return zoomIdentity.translate(x, y).scale(t.k);
}

/** Is the country already comfortably inside the visible part of the view? */
export function inView(view: View, bounds: Bounds, t: ZoomTransform): boolean {
  const b = box(view);
  const [[bx0, by0], [bx1, by1]] = bounds;
  const [x, y] = t.apply([(bx0 + bx1) / 2, (by0 + by1) / 2]);
  const size = Math.max(bx1 - bx0, by1 - by0) * t.k;
  const m = Math.min(32, b.w / 6, b.h / 6);
  return x > b.x0 + m && x < b.x1 - m && y > b.y0 + m && y < b.y1 - m && size > 10;
}
