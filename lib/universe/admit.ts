/**
 * `admit(candidate)`: the universe rule applied to one company. Pure — the
 * same rows and the same day give the same decision, with every reason.
 *
 *   theme        ≥1 fresh row placing it in a theme (or a tier A chain role)
 *   materiality  ≥1 fresh size figure at or over its floor (or a tier A chain role)
 *   identity     ≥1 registry identifier: ticker, CIK, LEI, QID, registry number
 *
 * Tier A: a hand-verified chain role; identity is reported, never a reason to
 * drop a sourced role. Tier B: all three tests pass on cited rows. Otherwise
 * not admitted, and `failed` names the tests.
 *
 * Rule: config/universe-themes.ts. Decided: docs/architecture/2026-10-25-company-universe.md.
 */
import {
  IDENTITY_KINDS,
  IDENTITY_LABEL,
  MAX_AGE_DAYS,
  SIZE_FLOORS,
  THEMES,
  type TestId,
  type ThemeId,
} from '@/config/universe-themes';
import type { Admission, Decision, TestResult, UniverseCandidate, UniverseRow } from './types';

const DAY = 86_400_000;

function ageDays(asOf: string, today: string): number {
  return Math.floor((Date.parse(today) - Date.parse(asOf)) / DAY);
}

export function usd(n: number): string {
  if (n >= 1e9) return `US$${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)} billion`;
  if (n >= 1e6) return `US$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)} million`;
  return `US$${Math.round(n).toLocaleString('en')}`;
}

const themeLabel = (id: ThemeId) => THEMES.find((t) => t.id === id)?.label ?? id;

function base(row: UniverseRow) {
  return {
    source: row.source.url,
    quote: row.source.quote,
    readOn: row.source.readOn,
    asOf: row.asOf,
  };
}

/** Rows a source is too old (or dated in the future) to count, set aside with the reason. */
function fresh(rows: readonly UniverseRow[], today: string) {
  const kept: UniverseRow[] = [];
  const setAside: Decision['setAside'] = [];
  for (const row of rows) {
    const age = ageDays(row.asOf, today);
    const max = MAX_AGE_DAYS[row.family];
    if (Number.isNaN(age)) setAside.push({ source: row.source.url, why: 'no readable as-of date' });
    else if (age < -1)
      setAside.push({ source: row.source.url, why: `dated ${row.asOf}, after today` });
    else if (age > max)
      setAside.push({
        source: row.source.url,
        why: `as of ${row.asOf}, ${age} days old; a ${row.family} source counts for ${max} days`,
      });
    else kept.push(row);
  }
  return { kept, setAside };
}

function themeTest(c: UniverseCandidate, rows: UniverseRow[]): TestResult {
  const evidence: Admission[] = [];
  if (c.chainRole)
    for (const theme of c.chainRole.themes)
      evidence.push({
        test: 'theme',
        theme,
        basis: 'chain-role',
        detail: `Hand-verified role in a tracked chain: ${c.chainRole.role}.`,
        source: c.chainRole.source,
        readOn: '',
        asOf: '',
      });
  for (const row of rows) {
    const e = row.establishes;
    if (!e.theme) continue;
    evidence.push({
      test: 'theme',
      theme: e.theme,
      basis: e.themeBasis ?? 'fund',
      detail: `${e.themeLabel ?? 'A cited source'}: ${themeLabel(e.theme)}.`,
      ...base(row),
    });
  }
  return evidence.length
    ? {
        pass: true,
        reason: `${new Set(evidence.map((a) => a.theme)).size} theme(s) cited.`,
        evidence,
      }
    : {
        pass: false,
        reason:
          'No fresh source places it in a theme: no thematic fund read here holds it, its filed industry code is not a theme code, and no programme list or industry class names it.',
        evidence,
      };
}

function materialityTest(c: UniverseCandidate, rows: UniverseRow[]): TestResult {
  if (c.chainRole)
    return {
      pass: true,
      reason: 'Its role in a tracked chokepoint is hand-verified (tier A).',
      evidence: [
        {
          test: 'materiality',
          basis: 'chain-role',
          detail: `Hand-verified chain role: ${c.chainRole.role}.`,
          source: c.chainRole.source,
          readOn: '',
          asOf: '',
        },
      ],
    };
  const sized = rows.filter((r) => r.establishes.size);
  const evidence: Admission[] = [];
  const under: string[] = [];
  for (const row of sized) {
    const size = row.establishes.size!;
    const floor = SIZE_FLOORS.find((f) => f.basis === size.basis);
    if (!floor) continue;
    if (size.usd >= floor.floorUsd)
      evidence.push({
        test: 'materiality',
        basis: size.basis,
        detail: `${usd(size.usd)} ${floor.measures} (floor ${usd(floor.floorUsd)}).`,
        ...base(row),
      });
    else under.push(`${usd(size.usd)} ${size.basis} is under the ${usd(floor.floorUsd)} floor`);
  }
  if (evidence.length) return { pass: true, reason: 'A cited figure clears its floor.', evidence };
  return {
    pass: false,
    reason: under.length
      ? `Every cited figure is under its floor: ${[...new Set(under)].join('; ')}.`
      : 'No cited size figure: no fund position, SEC public float, market value, revenue, valuation or round.',
    evidence,
  };
}

function identityTest(c: UniverseCandidate, rows: UniverseRow[]): TestResult {
  const evidence: Admission[] = [];
  const seen = new Set<string>();
  const add = (kind: string, value: string, a: Omit<Admission, 'test' | 'basis' | 'detail'>) => {
    if (seen.has(`${kind}:${value}`)) return;
    seen.add(`${kind}:${value}`);
    const label = IDENTITY_LABEL[kind as keyof typeof IDENTITY_LABEL];
    evidence.push({ test: 'identity', basis: kind, detail: `${label} ${value}`, ...a });
  };
  for (const kind of IDENTITY_KINDS) {
    const known = c.knownIds?.[kind];
    if (known && c.knownIdsSource)
      add(kind, known, { source: c.knownIdsSource, readOn: '', asOf: '' });
    for (const row of rows) {
      const v = row.establishes.ids?.[kind];
      if (v) add(kind, v, base(row));
    }
  }
  return evidence.length
    ? { pass: true, reason: `${evidence.length} identifier(s) cited.`, evidence }
    : {
        pass: false,
        reason:
          'No registry identifier cited: no ticker, SEC CIK, LEI, Wikidata QID or registry number.',
        evidence,
      };
}

const ORDER: TestId[] = ['theme', 'materiality', 'identity'];

export function admit(candidate: UniverseCandidate, opts: { today: string }): Decision {
  const { kept, setAside } = fresh(candidate.rows, opts.today);
  const tests: Record<TestId, TestResult> = {
    theme: themeTest(candidate, kept),
    materiality: materialityTest(candidate, kept),
    identity: identityTest(candidate, kept),
  };
  const failed = ORDER.filter((t) => !tests[t].pass);
  const tierA = Boolean(candidate.chainRole);
  const admitted = tierA || failed.length === 0;
  const themes = [
    ...new Set(tests.theme.evidence.map((a) => a.theme).filter((t): t is ThemeId => Boolean(t))),
  ].sort((a, b) => THEMES.findIndex((t) => t.id === a) - THEMES.findIndex((t) => t.id === b));
  return {
    slug: candidate.slug,
    name: candidate.name,
    admitted,
    tier: tierA ? 'A' : admitted ? 'B' : null,
    themes,
    admittedBy: admitted ? ORDER.flatMap((t) => tests[t].evidence) : [],
    tests,
    failed,
    setAside,
  };
}
