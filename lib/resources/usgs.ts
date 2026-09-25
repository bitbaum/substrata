/**
 * USGS world production and reserves, read from research/usgs-mcs.json.
 *
 * That file is written by scripts/research/usgs-mcs.py from the Mineral
 * Commodity Summaries chapter tables and is never edited by hand. Every value
 * keeps the USGS markers it was printed with — e (estimated), W (withheld),
 * NA, "more than" — because a withheld figure shown as a blank, or an estimate
 * shown as a measurement, is the kind of quiet error this site exists to avoid.
 *
 * This module only reads and reshapes. Shares, ranks, trends and
 * reserves-to-production are computed in the sibling modules and cite the
 * methods in lib/methods-resources.ts.
 */
import data from '@/research/usgs-mcs.json';

export interface UsgsCell {
  raw: string;
  value?: number;
  estimated?: boolean;
  withheld?: boolean;
  notAvailable?: boolean;
  zero?: boolean;
  moreThan?: boolean;
  lessThan?: boolean;
  qualitative?: string;
  footnoteOnly?: string;
  footnotes?: string[];
}

export interface UsgsColumn {
  key: string;
  measure: 'production' | 'reserves' | 'capacity';
  stage?: string;
  product?: string;
  year: number;
  estimated?: boolean;
  unit?: string;
}

export interface UsgsRow {
  name: string;
  kind: 'country' | 'other' | 'world';
  iso2?: string;
  cells: Record<string, UsgsCell>;
  footnotes: string[];
}

export interface UsgsChapter {
  slug: string;
  commodity: string;
  resource: string;
  url: string;
  table: string;
  unit: string;
  unitQuote: string;
  primary: string;
  columns: UsgsColumn[];
  rows: UsgsRow[];
  footnotes: Record<string, string>;
  events: string;
}

interface UsgsFile {
  source: string;
  edition: string;
  publisher: string;
  licence: string;
  retrieved: string;
  definitions: Record<string, string>;
  appendix: string;
  chapters: UsgsChapter[];
}

const FILE = data as unknown as UsgsFile;

export const USGS = {
  source: FILE.source,
  edition: FILE.edition,
  licence: FILE.licence,
  retrieved: FILE.retrieved,
  definitions: FILE.definitions,
  appendix: FILE.appendix,
};

export const UNIT_LABEL: Record<string, string> = {
  t: 'tonnes',
  kt: 'thousand tonnes',
  Mt: 'million tonnes',
  kg: 'kilograms',
  Mcm: 'million m³',
  Mct: 'million carats',
};

/** Multiply by this to express a value in its chapter's base unit (only Mt → kt differs today). */
const TO_BASE: Record<string, Record<string, number>> = { kt: { Mt: 1000 } };

export function chapters(): readonly UsgsChapter[] {
  return FILE.chapters;
}

export function chapterFor(resource: string): UsgsChapter | undefined {
  return FILE.chapters.find((c) => c.resource === resource);
}

export function resourcesWithData(): string[] {
  return FILE.chapters.map((c) => c.resource);
}

/** A production or capacity series: one (stage, product) across the table's years. */
export interface Series {
  /** Column key without the year, e.g. "mine", "refinery-alumina". */
  id: string;
  measure: 'production' | 'capacity' | 'reserves';
  label: string;
  unit: string;
  years: number[];
  /** Column key per year. */
  keys: Record<number, string>;
}

const STAGE_LABEL: Record<string, string> = {
  mine: 'Mine production',
  refinery: 'Refinery production',
  plant: 'Production',
  primary: 'Primary production',
};

function seriesLabel(col: UsgsColumn): string {
  if (col.measure === 'reserves') return col.product ? `Reserves (${col.product})` : 'Reserves';
  if (col.measure === 'capacity') return 'Production capacity';
  const stage = STAGE_LABEL[col.stage ?? ''] ?? 'Production';
  return col.product ? `${stage}, ${col.product}` : stage;
}

export function seriesOf(chapter: UsgsChapter): Series[] {
  const out = new Map<string, Series>();
  for (const col of chapter.columns) {
    const id = col.key.split(':')[0];
    const row = out.get(id) ?? {
      id,
      measure: col.measure,
      label: seriesLabel(col),
      unit: col.unit ?? chapter.unit,
      years: [],
      keys: {},
    };
    row.years.push(col.year);
    row.keys[col.year] = col.key;
    out.set(id, row);
  }
  return [...out.values()];
}

/** The series a resource is ranked and mapped on (declared per chapter in the data). */
export function primarySeries(chapter: UsgsChapter): Series {
  const all = seriesOf(chapter);
  return all.find((s) => s.id === chapter.primary) ?? all[0];
}

/**
 * The reserves series that pairs with a production series for
 * reserves-to-production, or undefined when USGS gives no like-for-like pair
 * (PGM reserves are all six metals; production is platinum and palladium).
 */
const RESERVES_PAIR: Record<string, { production: string; reserves: string }> = {
  iron: { production: 'mine-iron-content', reserves: 'reserves-iron-content' },
  bauxite: { production: 'mine-bauxite', reserves: 'reserves-bauxite' },
};

export function reservesPair(
  chapter: UsgsChapter,
): { production: Series; reserves: Series } | undefined {
  const all = seriesOf(chapter);
  const pair = RESERVES_PAIR[chapter.resource];
  const production = all.find((s) => s.id === (pair?.production ?? chapter.primary));
  const reserves = all.find((s) => s.id === (pair?.reserves ?? 'reserves'));
  if (!production || !reserves || production.measure !== 'production') return undefined;
  if (chapter.resource === 'pgms') return undefined;
  return { production, reserves };
}

export function reservesSeries(chapter: UsgsChapter): Series | undefined {
  return reservesPair(chapter)?.reserves ?? seriesOf(chapter).find((s) => s.measure === 'reserves');
}

/** A value converted to the chapter's base unit, or undefined when USGS gives no number. */
export function numeric(
  cell: UsgsCell | undefined,
  unit: string,
  base: string,
): number | undefined {
  if (!cell || cell.value === undefined) return undefined;
  const factor = unit === base ? 1 : (TO_BASE[base]?.[unit] ?? NaN);
  return Number.isNaN(factor) ? undefined : cell.value * factor;
}

export function worldRow(chapter: UsgsChapter): UsgsRow | undefined {
  return chapter.rows.find((r) => r.kind === 'world');
}

export function countryRows(chapter: UsgsChapter): UsgsRow[] {
  return chapter.rows.filter((r) => r.kind === 'country');
}

/** The footnote texts that apply to one cell or row, in print order. */
export function notesFor(chapter: UsgsChapter, ...marks: (string[] | undefined)[]): string[] {
  return [...new Set(marks.flatMap((m) => m ?? []))]
    .map((n) => chapter.footnotes[n])
    .filter((t): t is string => Boolean(t));
}

/** A cell as a reader should see it: the number, or what USGS printed instead. */
export function cellText(cell: UsgsCell | undefined): string {
  if (!cell) return 'not in the table';
  if (cell.withheld) return 'withheld (W)';
  if (cell.notAvailable) return 'not available';
  if (cell.qualitative) return cell.qualitative.toLowerCase();
  if (cell.footnoteOnly !== undefined) return 'see note';
  if (cell.zero) return 'none';
  const n = (cell.value ?? 0).toLocaleString('en');
  return `${cell.moreThan ? 'more than ' : ''}${cell.lessThan ? 'less than ' : ''}${n}`;
}
