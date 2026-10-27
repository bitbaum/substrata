/**
 * One-time migration: write a registry file for every company the old
 * universe filter admits today, from its own admission evidence, so the list
 * does not change when the registry becomes the source
 * (docs/architecture/2026-10-28-frontier-registry.md §6).
 *
 *   pnpm exec tsx scripts/registry/migrate.ts            writes registry/companies/*.json
 *
 * Existing files are never overwritten.
 */
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { AGENT_ROWS, UNIVERSE_FILE, buildUniverse } from '../../lib/universe/store';
import type { Admission, UniverseEntry } from '../../lib/universe/types';

const ROOT_AREA: Record<string, string> = {
  compute: 'compute-semiconductors',
  ai: 'frontier-ai',
  robotics: 'robotics',
  space: 'space',
  nuclear: 'nuclear-energy',
  grid: 'power-storage-grid',
  mobility: 'mobility',
  materials: 'advanced-materials',
  quantum: 'quantum',
  photonics: 'photonics',
  biotools: 'biotech-and-longevity',
  defence: 'defence-tech',
};

function evidenceOf(a: Admission) {
  const field =
    a.test === 'theme'
      ? `area:${ROOT_AREA[a.theme ?? '']}`
      : a.test === 'identity'
        ? `ids.${a.basis}`
        : `size:${a.basis}`;
  return {
    field,
    grade: a.basis === 'chain-role' ? 'stated' : 'registry',
    source: a.source,
    ...(a.quote ? { quote: a.quote } : { carried: true }),
    readOn: a.readOn,
    asOf: a.asOf,
    test: a.test,
    ...(a.theme ? { theme: a.theme } : {}),
    basis: a.basis,
    detail: a.detail,
    ...(a.usd ? { usd: a.usd } : {}),
  };
}

const ALL_ROWS = [...UNIVERSE_FILE.rows, ...AGENT_ROWS];

/** The row that backs the country shown today: a stated one, else the listing venue's, else the tier A role source. */
function countryEvidence(e: UniverseEntry) {
  const own = ALL_ROWS.filter((r) => r.company === e.slug);
  const row =
    own.find((r) => r.family === 'registry' && r.country) ??
    own.find((r) => r.country) ??
    own.find((r) => r.establishes.ids?.exchange);
  const source = row?.source ?? undefined;
  return {
    field: 'country',
    grade: 'registry',
    source: source?.url ?? e.admittedBy[0].source,
    ...(source?.quote ? { quote: source.quote } : { carried: true }),
    readOn: source?.readOn ?? '',
    asOf: row?.asOf ?? '',
    detail: row?.country
      ? `Country ${row.country} as the source states it.`
      : 'Country from its listing venue or hand-verified role.',
  };
}

function fileOf(e: UniverseEntry, on: string) {
  const ids = Object.fromEntries(Object.entries(e.ids).filter(([, v]) => v));
  return {
    slug: e.slug,
    name: e.name,
    aliases: e.aliases,
    kind: e.ids.ticker && e.ids.exchange ? 'public' : 'unclassified',
    status: 'active',
    ...(e.country ? { country: e.country } : {}),
    ids,
    areas: e.themes.map((t) => ({ area: ROOT_AREA[t] })),
    evidence: [...e.admittedBy.map(evidenceOf), ...(e.country ? [countryEvidence(e)] : [])],
    origin: { by: 'migration', on },
  };
}

const { entries, today } = buildUniverse();
let written = 0;
for (const e of entries.filter((x) => x.admitted)) {
  const file = path.join(process.cwd(), 'registry', 'companies', `${e.slug}.json`);
  if (existsSync(file)) continue;
  writeFileSync(file, JSON.stringify(fileOf(e, today), null, 2) + '\n');
  written++;
}
console.log(`wrote ${written} registry files`);
