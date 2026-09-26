/**
 * The globe's geometry, kept pure so it can be tested without a browser:
 * loading the countries once, where the disc sits in the visible part, and
 * where to look to face a country and how close. Moving between views is
 * globe-motion.ts; what is under a pixel is globe-pick.ts.
 *
 * Angles are degrees. A view is the point of the Earth facing the reader
 * (`center`, [lon, lat]) and a zoom factor `k` on top of the resting radius,
 * so a sheet rising or a panel opening only moves and resizes the disc — it
 * never changes what the reader is looking at.
 */
import { geoArea, geoCentroid, geoDistance, geoOrthographic, type GeoProjection } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiLineString,
  MultiPolygon,
  Position,
} from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';

import { capOf, type Cap } from './globe-cull';

/** Natural Earth 1:50m, built by scripts/geo/build-world-50m.mjs. */
const GEO_URL = '/geo/countries-50m.json';

export type CountryFeature = Feature<Geometry, { name: string; iso: string }>;

export interface Shapes {
  countries: CountryFeature[];
  /** Every border and coast once, so the outline is one stroke, not 240. */
  borders: MultiLineString;
  /** For culling the far side (globe-cull.ts): one per country, one per border line. */
  caps: Cap[];
  lineCaps: Cap[];
}

/**
 * The world at full detail, and a coarse copy — same countries, same order —
 * painted while the globe moves, so a drag stays inside a phone's frame
 * budget; the frame after it stops is full detail again.
 */
export interface World extends Shapes {
  coarse: Shapes;
}

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

export interface Camera {
  /** The point of the Earth at the centre of the disc, [lon, lat]. */
  center: [number, number];
  /** Zoom on top of the resting radius; 1 is the whole globe in view. */
  k: number;
}

export const MIN_ZOOM = 0.7;
export const MAX_ZOOM = 14;
/** How far north or south the reader can tilt: past this the poles spin. */
export const MAX_TILT = 75;
/** Where the globe rests with nothing picked: Africa, Europe and Asia. */
export const HOME: Camera = { center: [30, 18], k: 1 };

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

type WorldTopology = Topology<{ countries: GeometryCollection }>;

function shapesOf(topo: WorldTopology): Shapes {
  const fc = feature(topo, topo.objects.countries) as FeatureCollection<
    Geometry,
    { name: string; iso: string }
  >;
  const countries = fc.features.map((f) => rewound(f as CountryFeature));
  const borders = mesh(topo, topo.objects.countries);
  return {
    countries,
    borders,
    caps: countries.map((c) => capOf(c.geometry as MultiPolygon)),
    lineCaps: borders.coordinates.map((line) => capOf({ type: 'LineString', coordinates: line })),
  };
}

/**
 * Every `every`-th vertex of each arc, ends kept. Thinning the topology's arcs
 * rather than each country's rings keeps a shared border shared: neighbours
 * still meet exactly, with no slivers of sea between them.
 */
export function coarsened(topo: WorldTopology, every: number): WorldTopology {
  const t = topo.transform;
  const arcs = topo.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    const absolute = t
      ? arc.map(([dx, dy]) => {
          x += dx;
          y += dy;
          return [x * t.scale[0] + t.translate[0], y * t.scale[1] + t.translate[1]];
        })
      : arc;
    return absolute.filter((_, i) => i % every === 0 || i === absolute.length - 1);
  });
  return { ...topo, transform: undefined, arcs };
}

export function worldFrom(topo: WorldTopology): World {
  return { ...shapesOf(topo), coarse: shapesOf(coarsened(topo, 3)) };
}

let loading: Promise<World> | null = null;

export function loadWorld(): Promise<World> {
  loading ??= fetch(GEO_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`map data: ${r.status}`);
      return r.json() as Promise<WorldTopology>;
    })
    .then(worldFrom)
    .catch((error: unknown) => {
      loading = null; // let the next mount retry
      throw error;
    });
  return loading;
}

/* ------------------------------------------------------------ the disc */

/** Centre and resting radius of the globe in the visible part of the canvas. */
export function disc(view: View) {
  const w = Math.max(view.x1 - view.x0, 1);
  const h = Math.max(view.y1 - view.y0, 1);
  // Room around the limb for the atmosphere; a phone's strip above the sheet
  // is short and wide, so the height decides there.
  const radius = Math.max(Math.min(w, h) / 2 - Math.min(28, Math.min(w, h) * 0.08), 8);
  return { cx: view.x0 + w / 2, cy: view.y0 + h / 2, radius, short: Math.min(w, h) };
}

export const clampZoom = (k: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));
export const clampTilt = (lat: number) => Math.min(MAX_TILT, Math.max(-MAX_TILT, lat));

/** Longitude folded into (-180, 180]. */
export function wrapLon(lon: number): number {
  const x = (((lon + 180) % 360) + 360) % 360;
  return x === 0 ? 180 : x - 180;
}

/** The d3 rotation that turns `center` to face the reader. */
export function rotationOf(center: [number, number]): [number, number, number] {
  return [-center[0], -center[1], 0];
}

export function projectionFor(view: View, camera: Camera): GeoProjection {
  const d = disc(view);
  return (
    geoOrthographic()
      .clipAngle(90)
      // No adaptive resampling: 50m vertices are already closer than it would add.
      .precision(0)
      .translate([d.cx, d.cy])
      .scale(d.radius * camera.k)
      .rotate(rotationOf(camera.center))
  );
}

/* ------------------------------------------------------- facing a country */

type Ring = Position[];

function polygonsOf(g: Geometry): Ring[][] {
  if (g.type === 'Polygon') return [g.coordinates];
  if (g.type === 'MultiPolygon') return g.coordinates;
  return [];
}

/**
 * The part of a country to frame: its largest pieces, up to three quarters of
 * its area. The whole outline is wrong for the countries that matter most here
 * — the United States would be framed with Alaska and Hawaii (a view of the
 * Pacific), France with Guiana, Norway with Svalbard.
 */
export function mainland(f: CountryFeature): Ring[][] {
  const parts = polygonsOf(f.geometry)
    .map((coordinates) => ({ coordinates, area: geoArea({ type: 'Polygon', coordinates }) }))
    .sort((a, b) => b.area - a.area);
  const total = parts.reduce((s, p) => s + p.area, 0);
  const kept: Ring[][] = [];
  let sum = 0;
  for (const p of parts) {
    kept.push(p.coordinates);
    sum += p.area;
    if (sum >= total * 0.75) break;
  }
  return kept;
}

export interface Focus {
  /** [lon, lat] to turn to the reader. */
  center: [number, number];
  /** Degrees from the centre to the farthest point of the part framed. */
  reach: number;
}

/**
 * Where to look to face a country, and how much of the sphere it spans.
 * Spherical throughout (geoCentroid, geoDistance), so Russia, Fiji and the
 * United States — which cross the antimeridian — need no special case.
 */
export function focusOf(f: CountryFeature): Focus {
  const parts = mainland(f);
  if (parts.length === 0) return { center: HOME.center, reach: 90 };
  const shape = { type: 'MultiPolygon' as const, coordinates: parts };
  const [lon, lat] = geoCentroid(shape);
  const center: [number, number] = [lon, lat];
  let reach = 0;
  for (const polygon of parts)
    for (const point of polygon[0])
      reach = Math.max(reach, geoDistance(center, point as [number, number]));
  return { center, reach: (reach * 180) / Math.PI };
}

/**
 * The zoom that fits a country of angular `reach` in the disc. A point `r°`
 * from the centre of an orthographic view lies `R·sin r` from its middle, so
 * the country fills `sin(reach)` of the radius at k = 1. Small countries stop
 * at a readable zoom rather than filling the screen with one island.
 */
export function zoomFor(reach: number, fill = 0.72): number {
  const r = Math.min(Math.max(reach, 0.1), 90);
  const k = fill / Math.sin((r * Math.PI) / 180);
  return Math.min(Math.max(k, 1), 7);
}

export function cameraFor(f: CountryFeature): Camera {
  const { center, reach } = focusOf(f);
  return { center: [center[0], clampTilt(center[1])], k: zoomFor(reach) };
}
