import { loadGeographyResources, type GeographyManifest, type LicenseRule } from '@bitbaum/geo-kit';
import type { GeometryCollection, Topology } from 'topojson-specification';

type WorldTopology = Topology<{ countries: GeometryCollection }>;

const MANIFEST_URL = '/geo/manifest.json';
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAP_LICENSES: readonly LicenseRule[] = [
  { spdx: 'LicenseRef-Natural-Earth-Public-Domain', requiresAttribution: false },
  { spdx: 'ODbL-1.0', requiresAttribution: true },
];

/** Load one bounded world map resource, then verify its source and bytes. */
export async function fetchWorldTopology(): Promise<WorldTopology> {
  const response = await fetch(MANIFEST_URL, {
    credentials: 'omit',
    redirect: 'error',
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`map manifest: ${response.status}`);
  const contentLength = response.headers.get('content-length');
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_MANIFEST_BYTES) {
    throw new Error('map manifest exceeds its 64 KiB limit');
  }
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_MANIFEST_BYTES) {
    throw new Error('map manifest exceeds its 64 KiB limit');
  }

  const selected = await loadGeographyResources(
    JSON.parse(text) as GeographyManifest,
    {
      geographyIds: ['world'],
      kindKeys: ['administrative'],
      levelKeys: ['admin0'],
      asOf: new Date().toISOString().slice(0, 10),
      viewpointKey: 'natural-earth-de-facto',
      maxResources: 1,
      maxBytes: 512 * 1024,
    },
    {
      baseUrl: window.location.origin,
      licensePolicy: MAP_LICENSES,
    },
  );
  const data = selected[0]?.data as unknown as WorldTopology | undefined;
  if (selected.length !== 1 || data?.type !== 'Topology' || !data.objects?.countries) {
    throw new Error('map resource does not contain the expected countries topology');
  }
  return data;
}
