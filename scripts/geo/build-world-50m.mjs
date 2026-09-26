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
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ATLAS = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json';
const ISO = 'https://cdn.jsdelivr.net/npm/world-countries@5.1.0/countries.json';
/** Places Natural Earth draws that have no ccn3 in the ISO table. */
const EXTRA = { Kosovo: 'xk' };
/** Drawn as plain land, never listed or opened. */
const UNLISTED = new Set(['Antarctica']);

const [atlas, iso] = await Promise.all([ATLAS, ISO].map((u) => fetch(u).then((r) => r.json())));
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
    'public/geo/countries-50m.json',
  ],
  { stdio: 'inherit' },
);
