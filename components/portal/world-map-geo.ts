/**
 * The world map's geometry: loading the countries once, projecting them to a
 * box, and the zoom transform that frames the world or one country in it.
 * Pure functions apart from the one cached fetch, so WorldMap.tsx stays about
 * interaction.
 */
import { geoEqualEarth, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import { zoomIdentity, type ZoomTransform } from 'd3-zoom';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';

/** Natural Earth 1:50m, built by scripts/geo/build-world-50m.mjs. */
const GEO_URL = '/geo/countries-50m.json';

export type CountryFeature = Feature<Geometry, { name: string; iso: string }>;

let loading: Promise<CountryFeature[]> | null = null;

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
      return fc.features;
    })
    .catch((error: unknown) => {
      loading = null; // let the next mount retry
      throw error;
    });
  return loading;
}

const SPHERE: GeoPermissibleObjects = { type: 'Sphere' };
/** Leave the far south out of the fit: without Antarctica it is empty ocean. */
const FRAME: GeoPermissibleObjects = {
  type: 'Polygon',
  coordinates: [
    [
      [-179.9, -58],
      [179.9, -58],
      [179.9, 84],
      [-179.9, 84],
      [-179.9, -58],
    ],
  ],
};

export interface Frame {
  width: number;
  height: number;
  /** Pixels covered by the floating bar, the panel or the resting sheet. */
  inset: { top: number; right: number; bottom: number };
}

type Bounds = [[number, number], [number, number]];

/** The part of the frame nothing floats over, where the world is framed. */
function visibleBox({ width, height, inset }: Frame) {
  const x0 = 0;
  const x1 = Math.max(width - inset.right, width * 0.4);
  const y0 = inset.top;
  const y1 = Math.max(height - inset.bottom, y0 + height * 0.3);
  return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/** The projection fitted to the visible width, centred in the visible height. */
export function projectionFor(frame: Frame) {
  const box = visibleBox(frame);
  const pad = Math.min(24, box.w * 0.04);
  const projection = geoEqualEarth().fitWidth(box.w - pad * 2, FRAME);
  const [[, y0], [, y1]] = geoPath(projection).bounds(FRAME);
  const [tx, ty] = projection.translate();
  projection.translate([tx + box.x0 + pad, ty + box.cy - (y1 - y0) / 2 - y0]);
  return projection;
}

export function pathsFor(features: CountryFeature[], frame: Frame) {
  const path = geoPath(projectionFor(frame));
  return {
    sphere: path(SPHERE) ?? '',
    countries: features.map((f) => ({
      iso: f.properties.iso,
      name: f.properties.name,
      d: path(f) ?? '',
      bounds: path.bounds(f) as Bounds,
    })),
    frameBounds: path.bounds(FRAME) as Bounds,
  };
}

export const MAX_ZOOM = 12;

function centreOn(frame: Frame, x: number, y: number, k: number): ZoomTransform {
  const box = visibleBox(frame);
  return zoomIdentity.translate(box.cx - x * k, box.cy - y * k).scale(k);
}

/**
 * The resting view. A landscape frame shows the whole world; a portrait one
 * (a phone) would show a thin strip, so it starts zoomed until the land fills
 * about two thirds of the visible height, centred on Europe, Africa and Asia,
 * and the reader pans.
 */
export function homeTransform(frame: Frame, frameBounds: Bounds): ZoomTransform {
  const box = visibleBox(frame);
  const mapHeight = frameBounds[1][1] - frameBounds[0][1];
  const k = Math.min(3, Math.max(1, (box.h * 0.66) / mapHeight));
  if (k === 1) return zoomIdentity;
  const mapWidth = frameBounds[1][0] - frameBounds[0][0];
  return centreOn(
    frame,
    frameBounds[0][0] + mapWidth * 0.56,
    frameBounds[0][1] + mapHeight * 0.4,
    k,
  );
}

/** Frame one country: large ones fit, small ones stop at a readable zoom. */
export function focusTransform(frame: Frame, bounds: Bounds): ZoomTransform {
  const box = visibleBox(frame);
  const [[x0, y0], [x1, y1]] = bounds;
  const fit = Math.min((box.w * 0.6) / Math.max(x1 - x0, 1), (box.h * 0.6) / Math.max(y1 - y0, 1));
  return centreOn(frame, (x0 + x1) / 2, (y0 + y1) / 2, Math.max(1, Math.min(8, fit)));
}

/** Is the country already comfortably inside the visible part of the view? */
export function inView(frame: Frame, bounds: Bounds, t: ZoomTransform): boolean {
  const box = visibleBox(frame);
  const [x, y] = t.apply([(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2]);
  const size = Math.max(bounds[1][0] - bounds[0][0], bounds[1][1] - bounds[0][1]) * t.k;
  return x > box.x0 + 32 && x < box.x1 - 32 && y > box.y0 + 32 && y < box.y1 - 32 && size > 10;
}
