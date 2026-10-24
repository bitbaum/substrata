/**
 * The national figure a coverage ratio divides by.
 *
 * Priority, stated once: USGS Mineral Commodity Summaries for minerals, then
 * the World Nuclear Association table for uranium (USGS publishes none), then
 * EIA for energy — the first of those the repo holds a chapter for. That is the
 * order `lib/resources/usgs.ts` loads them in, and each resource has exactly
 * one chapter today, so the priority only ever decides between sources once a
 * second one is added. The yearbooks' own national tables are not held.
 */
import { chapters, type UsgsChapter } from '@/lib/resources/usgs';

const SOURCE_ORDER = ['USGS', 'WNA', 'EIA International Energy Statistics'];

export interface NationalFigure {
  source: string;
  edition: string;
  url: string;
  table: string;
  /** The series in words, as the source titles it. */
  series: string;
  unit: string;
  unitQuote: string;
  year: number;
  /** What the cell printed, verbatim. */
  printed: string;
  value: number | null;
  estimated: boolean;
  /** Why there is no number: withheld, not available. */
  missing?: string;
}

export function chapterFor(resource: string): UsgsChapter | undefined {
  const rank = (c: UsgsChapter) => {
    const i = SOURCE_ORDER.indexOf(c.source);
    return i === -1 ? SOURCE_ORDER.length : i;
  };
  return chapters()
    .filter((c) => c.resource === resource)
    .sort((a, b) => rank(a) - rank(b))[0];
}

/** Production series ids of a chapter, primary first. */
export function productionSeries(chapter: UsgsChapter): string[] {
  const ids = [
    ...new Set(
      chapter.columns.filter((c) => c.measure === 'production').map((c) => c.key.split(':')[0]),
    ),
  ];
  return ids.sort((a, b) => Number(b === chapter.primary) - Number(a === chapter.primary));
}

/** "2023" → 2023; "2020-21" → 2021 (the later year the chapter covers). */
export function chapterYear(year: string): number {
  const m = /^(\d{4})(?:-(\d{2}))?/.exec(year);
  if (!m) return NaN;
  return m[2] ? Number(m[1].slice(0, 2) + m[2]) : Number(m[1]);
}

/**
 * The country's figure for one series, in the year nearest `wanted` (the
 * facility table's year; the earlier year on a tie). Null when the country is
 * not in the table at all.
 */
export function nationalFigure(
  chapter: UsgsChapter,
  series: string,
  iso2: string,
  wanted: number,
): NationalFigure | null {
  const row = chapter.rows.find((r) => r.kind === 'country' && r.iso2 === iso2);
  if (!row) return null;
  const cols = chapter.columns
    .filter((c) => c.key.split(':')[0] === series && row.cells[c.key])
    .sort((a, b) => Math.abs(a.year - wanted) - Math.abs(b.year - wanted) || a.year - b.year);
  const col = cols[0];
  if (!col) return null;
  const cell = row.cells[col.key];
  const label =
    series === 'mine' || series.startsWith('mine-')
      ? `Mine production${series.startsWith('mine-') ? `, ${series.slice(5)}` : ''}`
      : series.startsWith('refinery')
        ? `Refinery production${series.startsWith('refinery-') ? `, ${series.slice(9)}` : ''}`
        : 'Production';
  return {
    source: chapter.source,
    edition: chapter.edition,
    url: chapter.url,
    table: chapter.table,
    series: label,
    unit: col.unit ?? chapter.unit,
    unitQuote: chapter.unitQuote,
    year: col.year,
    printed: cell.raw,
    value: cell.value ?? null,
    estimated: Boolean(cell.estimated ?? col.estimated),
    ...(cell.value === undefined
      ? {
          missing: cell.withheld
            ? 'withheld by the source (W) to protect company data'
            : cell.zero
              ? 'printed as zero'
              : `not a number ("${cell.raw}")`,
        }
      : cell.value === 0
        ? { missing: 'printed as zero' }
        : {}),
  };
}
