/**
 * Builds public/geo/countries-50m.json, the atlas' world map.
 *
 * Natural Earth 1:50m admin-0 countries (public domain) as packaged by
 * world-atlas, with each country's ISO 3166-1 alpha-2 code baked in as
 * `properties.iso` (from world-countries' ccn3 → cca2 table) so the map needs
 * no second lookup file. Antarctica is drawn (a globe without it has a hole
 * at the bottom) but carries no code: it is land, not a country to open. Simplified to ~30% of its vertices with
 * shapes kept, which is still sharper than 110m at any zoom the atlas allows
 * and small enough to ship (~95 KB compressed).
 *
 *   node scripts/geo/build-world-50m.mjs
 *
 * Needs the network and `npx mapshaper`. Run it only when changing the map.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ATLAS = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json';
const ISO = 'https://cdn.jsdelivr.net/npm/world-countries@5.1.0/countries.json';
/** Places Natural Earth draws that have no ccn3 in the ISO table. */
const EXTRA = { Kosovo: 'xk' };
/** Drawn as plain land, never listed or opened as a separate country. */
const UNLISTED = new Set(['Antarctica', 'Ashmore and Cartier Is.']);

async function fetchJson(url) {
  const response = await fetch(url, { redirect: 'error' });
  if (!response.ok) throw new Error(`source request failed (${response.status}): ${url}`);
  const retrievedAt = new Date().toISOString();
  return { value: await response.json(), retrievedAt };
}

const [
  { value: atlas, retrievedAt: naturalEarthRetrievedAt },
  { value: iso, retrievedAt: isoRetrievedAt },
] = await Promise.all([fetchJson(ATLAS), fetchJson(ISO)]);
const byNumeric = Object.fromEntries(
  iso.filter((c) => c.ccn3).map((c) => [c.ccn3, c.cca2.toLowerCase()]),
);
delete atlas.objects.land;
atlas.objects.countries.geometries = atlas.objects.countries.geometries.map(({ id, ...g }) => ({
  ...g,
  properties: {
    name: g.properties.name,
    iso: UNLISTED.has(g.properties.name) ? '' : (byNumeric[id] ?? EXTRA[g.properties.name] ?? ''),
  },
}));

const dir = mkdtempSync(join(tmpdir(), 'geo-'));
const outputDir = 'public/geo';
const outputPath = join(dir, 'countries-50m.json');
mkdirSync(outputDir, { recursive: true });

try {
  writeFileSync(join(dir, 'in.json'), JSON.stringify(atlas));
  execFileSync(
    'npx',
    [
      '-y',
      'mapshaper@0.6',
      join(dir, 'in.json'),
      '-simplify',
      '30%',
      'keep-shapes',
      '-o',
      'format=topojson',
      'quantization=100000',
      outputPath,
    ],
    { stdio: 'inherit' },
  );

  const bytes = readFileSync(outputPath);
  const topology = JSON.parse(bytes.toString('utf8'));
  const geometries = topology?.objects?.countries?.geometries;
  if (!Array.isArray(geometries) || geometries.length === 0) {
    throw new Error('mapshaper output has no countries geometry collection');
  }

  const countries = geometries
    .map(({ properties }) => properties)
    .filter((properties) => properties?.iso && properties?.name)
    .map(({ iso, name }) => ({ iso, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const generatedAt = new Date().toISOString();
  const manifest = {
    schemaVersion: 1,
    datasetVersion: `substrata-world-50m-${sha256.slice(0, 16)}`,
    generatedAt,
    sources: [
      {
        id: 'natural-earth-50m',
        publisher: 'Natural Earth, packaged by world-atlas maintainers',
        dataset: 'Natural Earth 1:50m Admin-0 countries, world-atlas@2.0.2',
        url: 'https://github.com/topojson/world-atlas/tree/v2.0.2',
        licenseSPDX: 'LicenseRef-Natural-Earth-Public-Domain',
        retrievedAt: naturalEarthRetrievedAt,
        attribution: 'Natural Earth; de facto boundary viewpoint by default.',
      },
      {
        id: 'world-countries-5-1-0',
        publisher: 'Mohammed Le Doze',
        dataset: 'world-countries@5.1.0 ISO 3166-1 alpha-2 lookup',
        url: 'https://github.com/mledoze/countries/tree/v5.1.0',
        licenseSPDX: 'ODbL-1.0',
        retrievedAt: isoRetrievedAt,
        attribution:
          'Contains information from world-countries@5.1.0 by Mohammed Le Doze, available under the Open Database License (ODbL) 1.0: https://opendatacommons.org/licenses/odbl/1-0/.',
      },
    ],
    viewpoints: [
      {
        key: 'natural-earth-de-facto',
        label: 'Natural Earth de facto',
        description:
          'Natural Earth’s default Admin-0 country layer depicts de facto control. This is one sourced map viewpoint, not a legal conclusion.',
        sourceIds: ['natural-earth-50m'],
      },
    ],
    resources: [
      {
        id: 'world-admin0-50m',
        sourceIds: ['natural-earth-50m', 'world-countries-5-1-0'],
        kindKey: 'administrative',
        geographyId: 'world',
        levelKey: 'admin0',
        format: 'topojson',
        href: '/geo/countries-50m.json',
        sha256,
        byteSize: bytes.byteLength,
        featureCount: geometries.length,
        validFrom: null,
        validTo: null,
        viewpointKey: 'natural-earth-de-facto',
      },
    ],
  };

  const outputs = [
    ['countries-50m.json', bytes],
    ['countries-index.json', Buffer.from(`${JSON.stringify(countries)}\n`)],
    ['manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)],
  ];
  for (const [name, content] of outputs) {
    const stagedPath = join(dir, name);
    writeFileSync(stagedPath, content);
    renameSync(stagedPath, join(outputDir, name));
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
