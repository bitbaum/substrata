/**
 * How a coverage result is put in front of a reader: a bounded headline, a
 * flag when one printed figure carries an implausible ratio, and a group row's
 * places one per line. Pure; the data is never altered or excluded here.
 */
import type { Coverage } from './ratio';
import { hasFigure, type RowWorking } from './rows';

/**
 * The headline value. Named capacity at or above the national figure is
 * "≥100%": capacity can exceed output, and "114%" read as an error to a visitor
 * even with the caveat. Below it, the percentage. The exact ratio stays in the
 * working.
 */
export function headline(ratio: number): { value: string; note: string | null } {
  if (ratio >= 1)
    return {
      value: '≥100%',
      note: 'named capacity covers the national figure (capacity can exceed output)',
    };
  return { value: `${Math.round(ratio * 100)}%`, note: null };
}

/** The exact ratio, for the working. */
export function exactRatio(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

/**
 * Above this, capacity against production stops being plausible as plants
 * running below capacity and becomes a question about a printed figure
 * (Canada nickel: one row prints 800 thousand t of "Ore, Ni content").
 */
export const IMPLAUSIBLE_RATIO = 3;

export interface Dominant {
  row: RowWorking;
  /** The row's share of the named capacity, 0–1. */
  share: number;
  /** One sentence a page and a data-entry model can both read. */
  note: string;
}

/** For an implausible ratio, the named row with the largest figure; null otherwise. */
export function dominantRow(c: Coverage): Dominant | null {
  if (c.status !== 'computed' || c.ratio <= IMPLAUSIBLE_RATIO) return null;
  const named = c.rows.filter(hasFigure).filter((r) => r.operators.length > 0);
  if (!named.length) return null;
  const top = named.reduce((a, b) => (b.figure.value > a.figure.value ? b : a));
  const share = top.figure.value / c.named.capacity;
  const where = splitLocations(top.location)[0] ?? top.location;
  return {
    row: top,
    share,
    note: `Check the row: one printed figure dominates — ${where} (${top.operators.map((o) => o.name).join(', ')}) prints ${top.printed.trim()} ${top.unit} under "${top.commodity}", ${Math.round(share * 100)}% of the named capacity. This is a question about the source table; the figure is shown as printed.`,
  };
}

/**
 * The places of a row USGS printed as a list ("Locations: … Province … Province").
 * Only a cell headed "Locations:" is split, at each "Province" followed by a new
 * place; any other cell is one place, as printed.
 */
export function splitLocations(location: string): string[] {
  const flat = location.replace(/\s+/g, ' ').trim();
  if (!/^locations:/i.test(flat)) return flat ? [flat] : [];
  return flat
    .replace(/^locations:\s*/i, '')
    .split(/(?<=\bProvince)\s+(?=[A-Z0-9])/)
    .filter(Boolean);
}
