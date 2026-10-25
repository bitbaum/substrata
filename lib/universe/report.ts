/**
 * The universe in numbers, as plain text: per tier, per theme, per country,
 * and every company considered and not admitted with the test it failed.
 * Printed by scripts/research/universe.ts; the same counts render on
 * /data/companies.
 */
import { THEMES } from '@/config/universe-themes';
import type { UniverseEntry } from './types';

export interface Counts {
  tiers: Record<'A' | 'B', number>;
  out: number;
  byTheme: { theme: string; label: string; count: number }[];
  byCountry: { country: string; count: number }[];
  /** Admitted with no country stated by any source. */
  noCountry: number;
  failedBy: Record<string, number>;
}

export function counts(entries: readonly UniverseEntry[]): Counts {
  const admitted = entries.filter((e) => e.admitted);
  const byCountry = new Map<string, number>();
  for (const e of admitted)
    if (e.country) byCountry.set(e.country, (byCountry.get(e.country) ?? 0) + 1);
  const failedBy: Record<string, number> = {};
  for (const e of entries.filter((x) => !x.admitted))
    for (const t of e.failed) failedBy[t] = (failedBy[t] ?? 0) + 1;
  return {
    tiers: {
      A: admitted.filter((e) => e.tier === 'A').length,
      B: admitted.filter((e) => e.tier === 'B').length,
    },
    out: entries.length - admitted.length,
    byTheme: THEMES.map((t) => ({
      theme: t.id,
      label: t.label,
      count: admitted.filter((e) => e.themes.includes(t.id)).length,
    })),
    byCountry: [...byCountry]
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country)),
    noCountry: admitted.filter((e) => !e.country).length,
    failedBy,
  };
}

export function report(built: { entries: readonly UniverseEntry[] }): string {
  const c = counts(built.entries);
  const lines = [
    `Admitted: ${c.tiers.A + c.tiers.B} (tier A ${c.tiers.A}, tier B ${c.tiers.B}); considered, not admitted: ${c.out}`,
    '',
    'By theme (a company may sit in several):',
    ...c.byTheme.map((t) => `  ${t.label}: ${t.count}`),
    '',
    `By country (${c.byCountry.length}; ${c.noCountry} with none stated):`,
    `  ${c.byCountry.map((x) => `${x.country} ${x.count}`).join(', ')}`,
    '',
    `Not admitted, by failed test: ${Object.entries(c.failedBy)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')}`,
  ];
  return lines.join('\n');
}
