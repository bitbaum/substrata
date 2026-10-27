/**
 * Registry → universe entries. The registry is the list: a registered company
 * is admitted because it is registered, and its evidence rows are the
 * `admittedBy` the pages print. A company the old filter admits but nobody has
 * registered is a *proposal*: it keeps its evidence, it is not on the list.
 *
 * Pure over its inputs. Decided: docs/architecture/2026-10-28-frontier-registry.md §3.
 */
import { THEMES, type ThemeId, type TestId } from '@/config/universe-themes';
import type { Admission, TestResult, UniverseEntry } from '@/lib/universe/types';
import type { Area, Company, Evidence } from './schema';

const ORDER: TestId[] = ['theme', 'materiality', 'identity'];

/** The test a row counts toward: the old filter's word when migrated, else by field. */
function testOf(e: Evidence): TestId {
  if (e.test) return e.test;
  return e.field.startsWith('area:') ? 'theme' : 'identity';
}

const FIELD_LABEL: Record<string, string> = {
  summary: 'What it is',
  country: 'Country',
  hq: 'Headquarters',
  parent: 'Owner',
  status: 'Status',
};

function labelOf(field: string, c: Company, areas: ReadonlyMap<string, Area>): string {
  if (field.startsWith('area:'))
    return `Area: ${areas.get(field.slice(5))?.name ?? field.slice(5)}`;
  if (field.startsWith('ids.'))
    return `${field.slice(4).toUpperCase()}${c.ids[field.slice(4) as keyof typeof c.ids] ? ` ${c.ids[field.slice(4) as keyof typeof c.ids]}` : ''}`;
  return FIELD_LABEL[field] ?? field;
}

function admission(e: Evidence, c: Company, areas: ReadonlyMap<string, Area>): Admission {
  const test = testOf(e);
  const areaTheme = e.field.startsWith('area:') ? areas.get(e.field.slice(5))?.theme : undefined;
  const theme = e.theme ?? areaTheme;
  return {
    test,
    ...(theme ? { theme } : {}),
    basis: e.basis ?? e.grade,
    detail: e.detail ?? `${labelOf(e.field, c, areas)}: ${e.quote ?? ''}`.trim(),
    source: e.source,
    ...(e.quote ? { quote: e.quote } : {}),
    readOn: e.readOn,
    asOf: e.asOf,
    ...(e.usd ? { usd: e.usd } : {}),
  };
}

function entryOf(c: Company, areas: ReadonlyMap<string, Area>, isTierA: boolean): UniverseEntry {
  // A migrated file's non-admission rows (country) are evidence, not admissions.
  const migrated = c.origin.by === 'migration';
  const rows = c.evidence.filter((e) => !migrated || e.test).map((e) => admission(e, c, areas));
  const themes = new Set<ThemeId>();
  for (const r of rows) if (r.test === 'theme' && r.theme) themes.add(r.theme);
  for (const a of c.areas) {
    const t = areas.get(a.area)?.theme;
    if (t) themes.add(t);
  }
  const tests = Object.fromEntries(
    ORDER.map((t): [TestId, TestResult] => [
      t,
      { pass: true, reason: 'Registered.', evidence: rows.filter((r) => r.test === t) },
    ]),
  ) as Record<TestId, TestResult>;
  return {
    slug: c.slug,
    name: c.name,
    admitted: true,
    tier: isTierA ? 'A' : 'B',
    themes: [...themes].sort(
      (a, b) => THEMES.findIndex((t) => t.id === a) - THEMES.findIndex((t) => t.id === b),
    ),
    admittedBy: ORDER.flatMap((t) => tests[t].evidence),
    tests,
    failed: [],
    setAside: [],
    registered: true,
    ...(c.country ? { country: c.country } : {}),
    ids: { ...c.ids },
    aliases: c.aliases,
  };
}

export interface OverlayDeps {
  companies: readonly Company[];
  areas: readonly Area[];
  /** Whether the directory profiles this slug (tier A). */
  isProfiled: (slug: string) => boolean;
}

export function overlayRegistry(
  base: readonly UniverseEntry[],
  deps: OverlayDeps,
): UniverseEntry[] {
  const areas = new Map(deps.areas.map((a) => [a.slug, a]));
  const registered = new Map(
    deps.companies.filter((c) => c.status === 'active').map((c) => [c.slug, c]),
  );
  const out: UniverseEntry[] = [];
  for (const e of base) {
    const c = registered.get(e.slug);
    if (c) {
      out.push(entryOf(c, areas, deps.isProfiled(c.slug)));
      registered.delete(e.slug);
    } else if (e.admitted) {
      out.push({ ...e, admitted: false, proposed: true, tier: null, admittedBy: [] });
    } else out.push(e);
  }
  for (const c of registered.values()) out.push(entryOf(c, areas, deps.isProfiled(c.slug)));
  return out;
}
