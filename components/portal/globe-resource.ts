import { loadGeographyManifest, loadGeographyResources, type LicenseRule } from '@bitbaum/geo-kit';
import type { GeometryCollection, Topology } from 'topojson-specification';

type WorldTopology = Topology<{ countries: GeometryCollection }>;

const MANIFEST_URL = '/geo/manifest.json';
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAP_LICENSES: readonly LicenseRule[] = [
  { spdx: 'LicenseRef-Natural-Earth-Public-Domain', requiresAttribution: false },
  { spdx: 'ODbL-1.0', requiresAttribution: true },
];

/** Application date and transport can be supplied by a historical view or a smoke check. */
interface WorldFetchOptions {
  baseUrl?: string;
  asOf?: string;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
}

/** Load one bounded world map resource, then verify its source and bytes. */
export async function fetchWorldTopology({
  baseUrl = window.location.origin,
  asOf = new Date().toISOString().slice(0, 10),
  signal,
  fetcher,
}: WorldFetchOptions = {}): Promise<WorldTopology> {
  const options = { baseUrl, signal, fetcher, licensePolicy: MAP_LICENSES };
  const manifest = await loadGeographyManifest(MANIFEST_URL, {
    ...options,
    maxBytes: MAX_MANIFEST_BYTES,
    maxResources: 4,
    maxByteSize: 512 * 1024,
  });
  const selected = await loadGeographyResources(
    manifest,
    {
      geographyIds: ['world'],
      kindKeys: ['administrative'],
      levelKeys: ['admin0'],
      asOf,
      viewpointKey: 'natural-earth-de-facto',
      maxResources: 1,
      maxBytes: 512 * 1024,
    },
    options,
  );
  const data = selected[0]?.data as unknown as WorldTopology | undefined;
  if (selected.length !== 1 || data?.type !== 'Topology' || !data.objects?.countries) {
    throw new Error('map resource does not contain the expected countries topology');
  }
  return data;
}
