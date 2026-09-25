/**
 * Export restrictions per country and resource, from the OECD Inventory of
 * Export Restrictions on Critical Raw Materials (research/oecd-export-restrictions.json,
 * written by scripts/research/oecd-export-restrictions.py, never by hand).
 *
 * A row is a measure the OECD recorded, with the legal text it points to.
 * Absence is "not recorded in the inventory", which covers about 80 exporting
 * countries; it is never "unrestricted".
 */
import data from '@/research/oecd-export-restrictions.json';

export interface RestrictionLine {
  hs: string;
  label: string;
  form: string;
  asLegislated?: string;
  sharedWith?: string;
}

export interface Restriction {
  iso2: string;
  resource: string;
  type: string;
  typeLabel: string;
  value: string | null;
  valueUnit: string | null;
  condition: string | null;
  introduced: string | null;
  ends: string | null;
  temporary: boolean;
  purpose: string | null;
  document: string | null;
  legalBasis: string | null;
  link: string | null;
  agency: string | null;
  note: string | null;
  lines: RestrictionLine[];
}

const FILE = data as unknown as {
  source: string;
  dataYear: number;
  explorer: string;
  licence: string;
  retrieved: string;
  scope: string;
  measures: Restriction[];
};

export const RESTRICTIONS_SOURCE = {
  label: `${FILE.source} (${FILE.dataYear} data)`,
  url: FILE.explorer,
  dataYear: FILE.dataYear,
  licence: FILE.licence,
  retrieved: FILE.retrieved,
  scope: FILE.scope,
};

/** Measure types that stop or cap flows, ranked ahead of taxes and paperwork. */
const WEIGHT: Record<string, number> = { M4: 0, M3: 1, M12: 2, M13: 3, M6: 4, M1: 5, M2: 5, M5: 6 };

function byWeight(a: Restriction, b: Restriction): number {
  return (
    (WEIGHT[a.type] ?? 9) - (WEIGHT[b.type] ?? 9) ||
    (b.introduced ?? '').localeCompare(a.introduced ?? '')
  );
}

export function restrictionsFor(iso2: string, resource?: string): Restriction[] {
  const id = iso2.toLowerCase();
  return FILE.measures
    .filter((m) => m.iso2 === id && (!resource || m.resource === resource))
    .sort(byWeight);
}

export function restrictionsOn(resource: string): Restriction[] {
  return FILE.measures.filter((m) => m.resource === resource).sort(byWeight);
}

/** Whether the inventory covers this country at all (it lists ~80 exporters). */
export function inInventory(iso2: string): boolean {
  const id = iso2.toLowerCase();
  return FILE.measures.some((m) => m.iso2 === id);
}

/** One line a reader can scan: "Export prohibition on ore (since 2023-07-17)". */
export function restrictionSummary(m: Restriction): string {
  const forms = [...new Set(m.lines.map((l) => l.form))].join(', ');
  const value =
    m.value && m.valueUnit ? ` ${m.value}${m.valueUnit === '%' ? '%' : ` ${m.valueUnit}`}` : '';
  const since = m.introduced ? ` since ${m.introduced}` : '';
  const until = m.ends ? `, until ${m.ends}` : '';
  return `${m.typeLabel}${value} on ${forms}${since}${until}`;
}
