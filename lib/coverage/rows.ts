/**
 * Facility rows as a coverage ratio reads them: one entry per printed row,
 * counted once, with the figure a sum may use and the operators the graph ties
 * to that row — or the reason for each that is missing.
 */
import { graphNode, relationsTo } from '@/lib/graph/index';
import type { GraphStore } from '@/lib/graph/store';
import { graphStore } from '@/lib/graph/store';
import { usgsFacilityId } from '@/lib/graph/usgs-operators';
import type { Facility } from '@/lib/resources/producers';
import { readRow, rowMatches, type SeriesSpec } from './basis';
import { figureFor, parseCapacity } from './capacity';
import { convert } from './units';

export interface NamedOperator {
  id: string;
  name: string;
  relationId: string;
}

export interface RowWorking {
  location: string;
  commodity: string;
  companies: string;
  /** The capacity cell and unit exactly as printed. */
  printed: string;
  unit: string;
  facility: string | null;
  /** True when the row measures what the national series measures; else why not. */
  compared: true | string;
  /** The row's capacity in the national unit, or why there is none. Set only on a compared row. */
  figure?: { value: number; estimated: boolean } | { reason: string };
  /** Operators with a stated or corroborated `operates` edge that cites this row (or another source). */
  operators: NamedOperator[];
}

/**
 * The identity of a printed row. Two rows with the same identity are the same
 * printed line (the yearbook files a row under more than one heading) and are
 * counted once. A row printed ONCE for a group — the Kazakh uranium row names
 * 16 ventures and one capacity for all of them — is one row and one figure: the
 * capacity is never repeated per operator and never divided between them.
 */
export function rowKey(f: Facility): string {
  const flat = (s: string) => s.replace(/\s+/g, ' ').trim();
  return [f.commodity, f.location, f.capacity, f.companies].map(flat).join('|');
}

export function distinctRows(rows: readonly Facility[]): Facility[] {
  const seen = new Set<string>();
  return rows.filter((f) => {
    const k = rowKey(f);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Counted operators of the row's place, tied to this row's own cell or to a source outside the chapter. */
export function rowOperators(
  iso2: string,
  f: Facility,
  chapterUrl: string,
  s: GraphStore = graphStore(),
): { facility: string | null; operators: NamedOperator[] } {
  const facility = usgsFacilityId(iso2, f.location);
  if (!facility) return { facility: null, operators: [] };
  const cell = f.companies.replace(/\s+/g, ' ').trim();
  // A place can hold rows of several firms ("Plant in Qaraghandy Province"), so
  // an edge names THIS row's operator only when it cites this cell, comes from
  // a source outside the chapter, or its operator is named in this cell (the
  // parser keeps one quote per edge when one firm runs two rows at a place).
  const operators = relationsTo(facility, { type: 'operates', minGrade: 'stated' }, s)
    .filter(
      (r) =>
        r.evidence.some((e) => e.source !== chapterUrl || e.quote === cell) ||
        cell.includes(graphNode(r.from, s).name),
    )
    .map((r) => ({ id: r.from, name: graphNode(r.from, s).name, relationId: r.id }));
  return { facility, operators };
}

export function readRows(
  iso2: string,
  rows: readonly Facility[],
  spec: SeriesSpec,
  singleStage: boolean,
  nationalUnit: string,
  chapterUrl: string,
  s: GraphStore = graphStore(),
): RowWorking[] {
  return distinctRows(rows).map((f) => {
    const match = rowMatches(readRow(f.group, f.commodity), spec, singleStage);
    const { facility, operators } = rowOperators(iso2, f, chapterUrl, s);
    const base = {
      location: f.location.replace(/\s+/g, ' ').trim(),
      commodity: f.commodity,
      companies: f.companies,
      printed: f.capacity,
      unit: f.unit,
      facility,
      operators,
    };
    if (match !== true) return { ...base, compared: match.reason };
    const fig = figureFor(parseCapacity(f.capacity), spec.material);
    if ('reason' in fig) return { ...base, compared: true, figure: fig };
    const c = convert(fig.value, f.unit, nationalUnit);
    if ('incomparable' in c) return { ...base, compared: true, figure: { reason: c.incomparable } };
    return { ...base, compared: true, figure: { value: c.value, estimated: fig.estimated } };
  });
}

export function hasFigure(r: RowWorking): r is RowWorking & { figure: { value: number; estimated: boolean } } {
  return r.compared === true && r.figure !== undefined && 'value' in r.figure;
}
