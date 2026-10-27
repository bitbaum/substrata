/**
 * The universe, built once: every company with evidence (research/universe.json
 * from the adapters, config/candidates/universe.json from add.ts) and every
 * directory company, each run through `admit`. Pure over committed files plus
 * today's date, so a stale source drops a company out on the day it goes stale.
 */
import adapterFile from '@/research/universe.json';
import agentRows from '@/config/candidates/universe.json';
import { HOME_COMPOSITE } from '@/lib/listings';
import { nameKey } from '@/lib/sources/name-key';
import { registry } from '@/lib/registry/load';
import { overlayRegistry } from '@/lib/registry/overlay';
import { participantBySlug } from '@/lib/participants';
import { admit } from './admit';
import { chainRoleOf, listedIds, tierAParticipants } from './tier-a';
import type { Identifiers, UniverseCandidate, UniverseEntry, UniverseRow } from './types';

export interface FundRead {
  id: string;
  url: string;
  asOf: string | null;
  rows: number;
  status: string;
}

export interface UniverseFile {
  version: 1;
  readOn: string;
  funds: FundRead[];
  rows: UniverseRow[];
}

export const UNIVERSE_FILE = adapterFile as unknown as UniverseFile;
export const AGENT_ROWS = agentRows as unknown as UniverseRow[];

/** "SPACE EXPLORATION TECHN-CL A" → "Space Exploration Techn"; a mixed-case name is kept. */
export function displayName(printed: string): string {
  const cut = printed
    .replace(/[-\s]+(CL|CLASS)\s+[A-Z]$/i, '')
    .replace(/[-\s]+(SPON(SORED)?\s+)?(GDR|ADR)(\s+REG\s*S|\s+REGS)?$/i, '')
    .replace(/[-\s]+(REG|REGISTERED|ORD|PREF)$/i, '')
    .replace(/\s+(ADR|SPONSORED ADR|-?REG|-?A|-?B|-?H)$/i, '')
    .trim();
  if (cut !== cut.toUpperCase()) return cut;
  return cut
    .toLowerCase()
    .replace(/(^|[\s(/&.-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/\b\p{L}{2,4}\b/gu, (w) =>
      KEEP_UPPER.has(w.toUpperCase()) || (!/[aeiouy]/i.test(w) && !KEEP_TITLE.has(w))
        ? w.toUpperCase()
        : w,
    );
}

const KEEP_TITLE = new Set(['Ltd', 'Hldgs', 'Grp', 'Mfg', 'Intl']);

/** Short words a holdings file prints in capitals that are acronyms, not words. */
const KEEP_UPPER = new Set(
  'NV AG SE SA ASA AB SPA PLC JSC PJSC OJSC NAC LG SK HD BYD TDK ABB AMD AI KK PT SKF USA UK ASML NEC IHI JX GE IPG MKS ON'.split(
    ' ',
  ),
);

const FAMILY_RANK = { registry: 0, filing: 1, statement: 2, fund: 3 } as const;

/**
 * The name to print: a Wikidata label first (it is cased as the company
 * writes itself), then any mixed-case name a registry or filing prints, then
 * the best upper-case one, title-cased.
 */
export function bestName(rows: readonly UniverseRow[]): string {
  const sorted = [...rows].sort(
    (a, b) =>
      Number(!a.establishes.ids?.qid) - Number(!b.establishes.ids?.qid) ||
      FAMILY_RANK[a.family] - FAMILY_RANK[b.family],
  );
  const cased = sorted.find((r) => r.name !== r.name.toUpperCase());
  return displayName((cased ?? sorted[0])?.name ?? '');
}

/** Listing venue (Bloomberg composite) → country; the extra codes are venues the funds print. */
const VENUE_COUNTRY = new Map<string, string>([
  ...Object.entries(HOME_COMPOSITE).map(([iso, code]) => [code, iso] as [string, string]),
  ['JT', 'JP'],
  ['LI', 'GB'],
  ['KQ', 'KR'],
  ['C1', 'CN'],
  ['C2', 'CN'],
  ['CV', 'CA'],
  ['CT', 'CA'],
  ['TW', 'TW'],
  ['SQ', 'ES'],
  ['FP', 'FR'],
  ['GY', 'DE'],
  ['NZ', 'NZ'],
  ['IB', 'IN'],
]);

function countryOf(rows: readonly UniverseRow[]): string | undefined {
  const registry = rows.find((r) => r.family === 'registry' && r.country);
  if (registry) return registry.country;
  const stated = rows.find((r) => r.country)?.country;
  if (stated) return stated;
  for (const r of rows) {
    const venue = r.establishes.ids?.exchange;
    if (venue && VENUE_COUNTRY.has(venue)) return VENUE_COUNTRY.get(venue);
  }
  return undefined;
}

function mergedIds(rows: readonly UniverseRow[], known: Identifiers): Identifiers {
  const ids: Identifiers = { ...known };
  for (const r of rows)
    for (const [k, v] of Object.entries(r.establishes.ids ?? {}))
      if (v && !(k in ids)) (ids as Record<string, string>)[k] = v;
  return ids;
}

function candidates(rows: readonly UniverseRow[]): (UniverseCandidate & { country?: string })[] {
  const bySlug = new Map<string, UniverseRow[]>();
  for (const r of rows) bySlug.set(r.company, [...(bySlug.get(r.company) ?? []), r]);
  const out: (UniverseCandidate & { country?: string })[] = [];
  for (const p of tierAParticipants()) {
    const own = bySlug.get(p.slug) ?? [];
    bySlug.delete(p.slug);
    const listed = listedIds(p.slug);
    out.push({
      slug: p.slug,
      name: p.name,
      rows: own,
      chainRole: chainRoleOf(p),
      knownIds: listed.ids,
      ...(listed.source ? { knownIdsSource: listed.source } : {}),
      country: p.jurisdictions[0],
    });
  }
  for (const [slug, own] of [...bySlug].sort(([a], [b]) => a.localeCompare(b))) {
    out.push({ slug, name: bestName(own), rows: own, country: countryOf(own) });
  }
  return out;
}

interface Built {
  today: string;
  entries: UniverseEntry[];
  bySlug: Map<string, UniverseEntry>;
  byLabel: Map<string, UniverseEntry>;
}

let built: Built | null = null;

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function buildUniverse(
  rows: readonly UniverseRow[] = [...UNIVERSE_FILE.rows, ...AGENT_ROWS],
  today = todayIso(),
): Built {
  const entries = candidates(rows).map((c): UniverseEntry => {
    const decision = admit(c, { today });
    const names = [...new Set(c.rows.map((r) => displayName(r.name)))].filter((n) => n !== c.name);
    return {
      ...decision,
      ...(c.country ? { country: c.country.toUpperCase() } : {}),
      ids: mergedIds(c.rows, c.knownIds ?? {}),
      aliases: names,
    };
  });
  return withEntries(today, entries);
}

function withEntries(today: string, entries: UniverseEntry[]): Built {
  const bySlug = new Map(entries.map((e) => [e.slug, e]));
  const byLabel = new Map<string, UniverseEntry>();
  const label = (s: string | undefined, e: UniverseEntry) => {
    const k = s ? nameKey(s) : '';
    if (k && !byLabel.has(k)) byLabel.set(k, e);
  };
  // Admitted first, so a shared label resolves to the company that is in.
  for (const e of [...entries].sort((a, b) => Number(b.admitted) - Number(a.admitted))) {
    label(e.slug.replace(/-/g, ' '), e);
    label(e.name, e);
    for (const a of e.aliases) label(a, e);
    for (const v of [e.ids.ticker, e.ids.cik, e.ids.lei, e.ids.qid]) label(v, e);
  }
  return { today, entries, bySlug, byLabel };
}

/**
 * The list: the registry (registry/companies) over what the filter finds. A
 * registered company is in; a company only the filter admits is a proposal
 * (docs/architecture/2026-10-28-frontier-registry.md).
 */
export function universe(): Built {
  const today = todayIso();
  if (!built || built.today !== today) {
    const filtered = buildUniverse(undefined, today);
    const r = registry();
    built = withEntries(
      filtered.today,
      overlayRegistry(filtered.entries, {
        companies: r.companies,
        areas: r.areas,
        isProfiled: (slug) => Boolean(participantBySlug(slug)),
      }),
    );
  }
  return built;
}

export function universeEntries(): UniverseEntry[] {
  return universe().entries;
}

export function universeEntry(slug: string): UniverseEntry | undefined {
  return universe().bySlug.get(slug);
}

/** By slug, name, alias, ticker, CIK, LEI or QID. */
export function findUniverseEntry(nameOrId: string): UniverseEntry | undefined {
  const u = universe();
  const raw = nameOrId.trim().replace(/^company:/, '');
  const exact =
    u.bySlug.get(raw) ?? u.byLabel.get(nameKey(raw)) ?? u.byLabel.get(raw.toUpperCase());
  if (exact) return exact;
  // "NuScale" for "NuScale Power Corp": a unique company whose name holds the words asked.
  const key = nameKey(raw);
  if (key.length < 3) return undefined;
  // "Kazatomprom" for "NAC Kazatomprom": the words asked, whole, anywhere in the name.
  const hits = new Set(
    [...u.byLabel].filter(([label]) => ` ${label} `.includes(` ${key} `)).map(([, e]) => e),
  );
  const admitted = [...hits].filter((e) => e.admitted);
  if (admitted.length === 1) return admitted[0];
  return hits.size === 1 ? [...hits][0] : undefined;
}
