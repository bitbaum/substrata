/**
 * Counting helpers every kind's counters share: how a row is graded when it
 * carries no grade of its own, and a typed read of the USGS facility rows.
 */
import usgs from '@/research/usgs-producers.json';
import type { RowCounts } from '../definitions';

/**
 * A curated row (committed to config by a person, or an agency table) reads
 * `stated`; a candidate row (config/candidates, unpromoted) reads `lead`.
 */
export function gradeOf(row: { evidence?: string }): 'stated' | 'lead' {
  return row.evidence === 'candidate' ? 'lead' : 'stated';
}

/** Counts by grade from a list of rows and a grader. */
export function tally<T>(
  rows: readonly T[],
  grade: (row: T) => 'stated' | 'corroborated' | 'derived' | 'lead',
  basis: string,
  extra: Partial<Pick<RowCounts, 'expected' | 'core'>> = {},
): RowCounts {
  const c: RowCounts = { stated: 0, corroborated: 0, derived: 0, lead: 0, basis, ...extra };
  for (const row of rows) c[grade(row)] += 1;
  return c;
}

/** Add two counts, joining their bases. */
export function plus(a: RowCounts, b: RowCounts): RowCounts {
  return {
    stated: a.stated + b.stated,
    corroborated: a.corroborated + b.corroborated,
    derived: a.derived + b.derived,
    lead: a.lead + b.lead,
    expected: a.expected ?? b.expected,
    core: a.core === undefined && b.core === undefined ? undefined : (a.core ?? 0) + (b.core ?? 0),
    basis: [a.basis, b.basis].filter(Boolean).join('; '),
  };
}

export const NOTHING: RowCounts = { stated: 0, corroborated: 0, derived: 0, lead: 0, basis: '' };

export interface UsgsFacilityRow {
  iso2: string;
  year: string;
  resource: string;
  companies: string;
  location: string;
}

const FILE = usgs as unknown as {
  countries: { iso2: string; year: string; facilities: Omit<UsgsFacilityRow, 'iso2' | 'year'>[] }[];
};

/** Every USGS Minerals Yearbook facility row, flattened once. */
export const USGS_ROWS: readonly UsgsFacilityRow[] = FILE.countries.flatMap((c) =>
  c.facilities.map((f) => ({
    iso2: c.iso2,
    year: c.year,
    resource: f.resource,
    companies: f.companies,
    location: f.location,
  })),
);

/** The chapter year USGS printed for a country, or null when no chapter was read. */
export function usgsYear(iso2: string): string | null {
  return FILE.countries.find((c) => c.iso2 === iso2)?.year ?? null;
}

/**
 * The operating company a USGS row names: the text before its bracketed owner
 * list. `Aluminium of Kazakhstan JSC [Eurasian Resources Group (ERG), 100%]`
 * → `Aluminium of Kazakhstan JSC`. Some rows are cut off inside the bracket,
 * so the bracket is never parsed here; the graph's operator parser does that.
 */
export function operatorOf(companies: string): string | null {
  const name = companies
    .split(/[[{(]/)[0]
    .replace(/[,.;\s]+$/, '')
    .trim();
  return name.length >= 3 && !/^(na|n\.a|do|ditto|undetermined)$/i.test(name) ? name : null;
}
