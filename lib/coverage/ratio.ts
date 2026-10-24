/**
 * How much of a country's output for a resource the corpus can attribute to
 * named operators — the mass balance of docs/architecture/2026-10-24-research-
 * systems.md §4, computed from `stated` and `corroborated` rows only.
 *
 * Every result carries its inputs (each row with its printed capacity, the
 * national figure with its source) so a page shows the working, and a result
 * that cannot be computed says exactly why. No ratio is returned without its basis.
 */
import { resourceLabel } from '@/config/substrata-resources';
import { graphStore } from '@/lib/graph/index';
import type { GraphStore } from '@/lib/graph/store';
import { allFacilitiesFor, facilitiesFor, type Facility } from '@/lib/resources/producers';
import { SERIES_SPECS, specsFor, readRow, rowMatches } from './basis';
import { chapterFor, chapterYear, nationalFigure, productionSeries, type NationalFigure } from './national';
import { readRows, hasFigure, type RowWorking } from './rows';
import { attribution, type Attribution } from './shares';

/** The ratio is capacity over production, and the label says so every time it is printed. */
export const RATIO_LABEL = 'named capacity / national production';
export const RATIO_CAVEAT =
  'Capacity is what the named plants can produce, not what they produced: plants run below capacity, so this can pass 100% and is not a share of output. No source here states production per facility, so "named operators made X% of output" is not claimed.';

export interface FacilityTable {
  year: string;
  url: string;
  table: string;
}

interface Base {
  iso2: string;
  resource: string;
  label: string;
  table: FacilityTable | null;
  rows: RowWorking[];
  attribution: Attribution;
}

export type Coverage =
  | (Base & {
      status: 'computed';
      ratio: number;
      ratioLabel: string;
      caveat: string;
      basis: string;
      national: NationalFigure & { value: number };
      named: { capacity: number; rows: number };
      listed: { capacity: number; rows: number };
      unit: string;
      /** Years between the facility table and the national figure; 0 when they match. */
      yearGap: number;
    })
  | (Base & { status: 'cannot'; reason: string; national: NationalFigure | null; basis: string | null });

function cannot(
  base: Base,
  reason: string,
  national: NationalFigure | null = null,
  basis: string | null = null,
): Coverage {
  return { ...base, status: 'cannot', reason, national, basis };
}

/** The first series, in SERIES_SPECS priority, that at least one printed row measures. */
function pickSpec(resource: string, rows: readonly Facility[], singleStage: boolean) {
  return specsFor(resource).find((spec) =>
    rows.some((f) => rowMatches(readRow(f.group, f.commodity), spec, singleStage) === true),
  );
}

export function coverageFor(iso2: string, resource: string, s: GraphStore = graphStore()): Coverage {
  const id = iso2.toLowerCase();
  const table = facilitiesFor(id, resource);
  const facilityTable = table ? { year: table.year, url: table.pdf || table.url, table: table.table } : null;
  const attr = attribution(id, resource, table, s);
  const base: Base = { iso2: id, resource, label: resourceLabel(resource), table: facilityTable, rows: [], attribution: attr };
  const chapter = chapterFor(resource);
  if (!table)
    return cannot(base, 'no USGS Minerals Yearbook facility table has been read for this country');
  if (!table.rows.length)
    return cannot(base, `the ${table.year} facility table lists no ${base.label.toLowerCase()} facility`);
  if (!chapter) return cannot(base, 'no national production series for this resource is held');
  const series = productionSeries(chapter);
  const singleStage = series.length === 1;
  const spec = pickSpec(resource, table.rows, singleStage);
  if (!spec) {
    const fallback = specsFor(resource)[0];
    const rows = fallback
      ? readRows(id, table.rows, fallback, singleStage, chapter.unit, table.url, s)
      : [];
    const why = [...new Set(rows.map((r) => (r.compared === true ? '' : r.compared)).filter(Boolean))];
    return cannot(
      { ...base, rows },
      fallback
        ? `no row measures what the national figure measures (${fallback.basis}): ${why.slice(0, 3).join('; ')}`
        : `no national series is matched to facility rows for ${base.label.toLowerCase()} yet`,
    );
  }
  const wanted = chapterYear(table.year);
  const national = nationalFigure(chapter, spec.series, id, wanted);
  const unit = national?.unit ?? chapter.unit;
  const rows = readRows(id, table.rows, spec, singleStage, unit, table.url, s);
  const withRows = { ...base, rows };
  if (!national)
    return cannot(withRows, `${chapter.source} lists no ${spec.basis} figure for this country`, null, spec.basis);
  if (national.value === null || national.missing)
    return cannot(withRows, `the national figure is ${national.missing ?? 'missing'}`, national, spec.basis);
  const counted = rows.filter(hasFigure);
  if (!counted.length) {
    const why = [...new Set(rows.filter((r) => r.compared === true && r.figure && 'reason' in r.figure).map((r) => (r.figure as { reason: string }).reason))];
    return cannot(withRows, `no compared row prints a usable capacity (${why.join('; ') || 'none compared'})`, national, spec.basis);
  }
  const named = counted.filter((r) => r.operators.length > 0);
  const sum = (rs: typeof counted) => rs.reduce((t, r) => t + r.figure.value, 0);
  return {
    ...withRows,
    status: 'computed',
    ratio: sum(named) / national.value,
    ratioLabel: RATIO_LABEL,
    caveat: RATIO_CAVEAT,
    basis: spec.basis,
    national: national as NationalFigure & { value: number },
    named: { capacity: sum(named), rows: named.length },
    listed: { capacity: sum(counted), rows: counted.length },
    unit,
    yearGap: Math.abs(national.year - wanted),
  };
}

/**
 * Resources worth a row for a country: every one its facility table files,
 * then every one a national table measures for it (withheld counts: the
 * country produces it, the source will not say how much).
 */
export function coverageResources(iso2: string): string[] {
  const id = iso2.toLowerCase();
  const out = new Set(allFacilitiesFor(id)?.rows.map((f) => f.resource) ?? []);
  for (const resource of new Set(SERIES_SPECS.map((spec) => spec.resource))) {
    const chapter = chapterFor(resource);
    const row = chapter?.rows.find((r) => r.kind === 'country' && r.iso2 === id);
    const primary = chapter ? productionSeries(chapter)[0] : undefined;
    const produces = Object.entries(row?.cells ?? {}).some(
      ([key, cell]) => key.startsWith(`${primary}:`) && ((cell.value ?? 0) > 0 || cell.withheld),
    );
    if (produces) out.add(resource);
  }
  return [...out];
}

/** Every resource row for a country: computed ones first, highest ratio first, then the ones that cannot be. */
export function coverageOf(iso2: string, s: GraphStore = graphStore()): Coverage[] {
  return coverageResources(iso2)
    .map((r) => coverageFor(iso2, r, s))
    .sort((a, b) =>
      a.status !== b.status
        ? a.status === 'computed' ? -1 : 1
        : a.status === 'computed' && b.status === 'computed'
          ? b.ratio - a.ratio
          : a.label.localeCompare(b.label),
    );
}
