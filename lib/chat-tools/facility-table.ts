/**
 * The USGS facility rows of one country as an answer table (lib/chat/answer-table.ts):
 * operator | owners as printed | commodity | location | capacity as printed | year.
 *
 * A cell that lists several ventures ("Companies: Akbastau JV (…) APPAK LLP
 * (…) …", the Kazakh uranium row) becomes one table row per venture, split
 * where `readCompanies` splits it; the place list and the capacity USGS
 * printed ONCE for all of them are not divided among the ventures — nothing
 * says which place is whose — so they become a shared note under those rows.
 */
import type { AnswerTable, SharedCell, TableRow } from '../chat/answer-table';
import type { Facility } from '../resources/producers';
import { capacityOf, readCompanies } from './producers';

/** More rows than this and the answer carries a table instead of a list. */
export const TABLE_MIN_ROWS = 4;

export function facilityTable(opts: {
  country: string;
  iso2: string;
  resource?: string;
  year: string;
  table: string;
  url: string;
  sourceLabel: string;
  rows: Facility[];
}): AnswerTable | null {
  const rows: TableRow[] = [];
  const shared: SharedCell[] = [];
  for (const f of opts.rows) {
    const readings = readCompanies(f.companies);
    const capacity = capacityOf(f).display;
    // What the capacity is OF: the Kazakh "uranium" rows include a rare-earth plant.
    const commodity = f.commodity || f.group || null;
    const location = f.location.replace(/\s+/g, ' ').trim() || null;
    if (readings.length > 1) {
      const first = rows.length;
      for (const r of readings)
        rows.push({
          operator: r.operator,
          owners: r.owner,
          commodity,
          location: null,
          capacity: null,
          year: opts.year,
        });
      const span: [number, number] = [first, rows.length - 1];
      const n = readings.length;
      if (location)
        shared.push({
          label: `Locations of these ${n} ventures (one list, as printed)`,
          text: location,
          rows: span,
        });
      if (capacity)
        shared.push({
          label: `Capacity of all ${n} together (as printed)`,
          text: capacity,
          rows: span,
        });
    } else {
      const r = readings[0] ?? { operator: f.companies, owner: null };
      rows.push({
        operator: r.operator,
        owners: r.owner,
        commodity,
        location,
        capacity,
        year: opts.year,
      });
    }
  }
  if (rows.length < TABLE_MIN_ROWS) return null;
  const what = opts.resource ? `${opts.resource.replace(/-/g, ' ')} ` : '';
  return {
    id: `usgs-${opts.iso2}-${opts.resource ?? 'all'}-${opts.year}`,
    caption: `${what[0]?.toUpperCase() ?? ''}${what.slice(1)}${what ? 'facilities' : 'Facilities'} in ${opts.country} — USGS Minerals Yearbook ${opts.year}`,
    columns: [
      { key: 'operator', label: 'Operator' },
      { key: 'owners', label: 'Owners and shares, as printed' },
      { key: 'commodity', label: 'Commodity, as printed' },
      { key: 'location', label: 'Location' },
      { key: 'capacity', label: 'Capacity, as printed' },
      { key: 'year', label: 'Year' },
    ],
    rows,
    shared,
    source: { label: `${opts.sourceLabel}, ${opts.table}`, url: opts.url },
    note: 'Every cell is copied from the USGS table as printed. Capacity is capacity, not production. The table names no buyers.',
  };
}
