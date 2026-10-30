/**
 * Substrata's world on the fleet's one map renderer (`@bitbaum/geo-kit/map`):
 * the countries of Natural Earth 1:50m keyed by their ISO code, where the
 * globe rests, and how close it comes to a country. The geometry, movement,
 * picking and painting are the package's; what is here is Substrata's data.
 */
import {
  WORLD_LIMITS,
  cameraFor as cameraForGeometry,
  focusOf as focusOfGeometry,
  shapesFromTopology,
  type Camera,
  type Focus,
  type MapFeature,
  type MapShapes,
} from '@bitbaum/geo-kit/map';
import type { Topology } from 'topojson-specification';

import { fetchWorldTopology } from './globe-resource';

export { clampTilt, type Camera, type View } from '@bitbaum/geo-kit/map';

export type CountryFeature = MapFeature<{ name: string; iso: string }>;

/** The shapes the globe paints, with the countries under their old name. */
export type World = MapShapes<{ name: string; iso: string }> & { countries: CountryFeature[] };

export const LIMITS = WORLD_LIMITS;
/** Where the globe rests with nothing picked: Africa, Europe and Asia. */
export const HOME: Camera = { center: [30, 18], k: 1 };

/** A country with no ISO code (Somaliland, N. Cyprus) is drawn, never picked. */
const NAMELESS = 'unlisted:';
export const isCountry = (id: string | null): id is string => !!id && !id.startsWith(NAMELESS);

/** Natural Earth's countries, as the map resource carries them. */
export function worldFrom(topo: Topology): World {
  const shapes = shapesFromTopology<{ name: string; iso: string }>(topo, {
    object: 'countries',
    idOf: (f) => f.properties.iso || `${NAMELESS}${f.properties.name}`,
  });
  return { ...shapes, countries: shapes.features };
}

let loading: Promise<World> | null = null;

export function loadWorld(): Promise<World> {
  loading ??= fetchWorldTopology()
    .then((topo) => worldFrom(topo as unknown as Topology))
    .catch((error: unknown) => {
      loading = null; // let the next mount retry
      throw error;
    });
  return loading;
}

/** Where to look to face a country, and how much of the sphere it spans. */
export function focusOf(f: CountryFeature): Focus {
  return focusOfGeometry(f.geometry) ?? { center: HOME.center, reach: 90 };
}

export function cameraFor(f: CountryFeature): Camera {
  return cameraForGeometry(f.geometry, LIMITS) ?? HOME;
}
