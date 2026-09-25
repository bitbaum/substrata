/**
 * One resource, one number per country — what the world map paints.
 *
 * Pure: no React, no I/O beyond the committed JSON. The map (WorldMap) calls
 * `choropleth('nickel')` and colours each ISO code by `share` (or `value`),
 * labels the legend with `label` + `unitLabel` + `year`, and links `source`.
 *
 *   choropleth(resource, { measure: 'production' | 'reserves', year? })
 *     → Choropleth | null   (null: USGS has no table for that resource/measure)
 *   choroplethOptions()     → which resources/measures have data, for a picker
 *
 * Rules the map must keep:
 * - A country absent from `values` is not zero. USGS folds small producers
 *   into "Other countries"; say "not listed", never paint it as none.
 * - `status` other than 'value' (withheld, not available, qualitative) is not
 *   a number: paint it as a pattern or neutral, never as the scale's floor.
 * - `share` is null when the world total is missing or printed as "more than"
 *   (a share of a lower bound would overstate the country).
 * - Shares and ranks are computed (methods 'share' and 'world-rank');
 *   the values themselves are USGS's, from `source`.
 */
import {
  UNIT_LABEL,
  USGS,
  cellText,
  chapterFor,
  chapters,
  countryRows,
  numeric,
  primarySeries,
  reservesSeries,
  seriesOf,
  worldRow,
  type Series,
} from './usgs';

export type ChoroplethMeasure = 'production' | 'reserves';

export type ChoroplethStatus = 'value' | 'none' | 'withheld' | 'not-available' | 'qualitative';

export interface ChoroplethValue {
  iso2: string;
  /** Country name as USGS prints it. */
  name: string;
  /** In `unit`; null when USGS gives no number. */
  value: number | null;
  /** Fraction of the world total, 0–1; null when it cannot be computed honestly. */
  share: number | null;
  /** 1 = largest among the countries USGS lists individually; null without a positive value. */
  rank: number | null;
  estimated: boolean;
  status: ChoroplethStatus;
  /** What to print: the number with USGS's qualifiers, or what USGS printed instead. */
  text: string;
  /** USGS footnote texts on this row or cell. */
  notes: string[];
}

export interface Choropleth {
  resource: string;
  commodity: string;
  measure: ChoroplethMeasure;
  /** Series id, e.g. "mine", "mine-bauxite", "plant-silicon-metal". */
  series: string;
  /** "Mine production", "Reserves (bauxite)" … */
  label: string;
  unit: string;
  unitLabel: string;
  year: number;
  world: { value: number | null; moreThan: boolean; text: string };
  values: Record<string, ChoroplethValue>;
  /** Largest numeric value, for scaling. */
  max: number;
  /** Sum of the positive values' shares' squares: the HHI over listed countries (null without shares). */
  hhi: number | null;
  source: { url: string; label: string; edition: string; table: string; retrieved: string };
}

function statusOf(
  cell:
    | {
        withheld?: boolean;
        notAvailable?: boolean;
        qualitative?: string;
        zero?: boolean;
        value?: number;
      }
    | undefined,
): ChoroplethStatus {
  if (!cell) return 'not-available';
  if (cell.withheld) return 'withheld';
  if (cell.notAvailable) return 'not-available';
  if (cell.qualitative) return 'qualitative';
  if (cell.zero || cell.value === 0) return 'none';
  return cell.value === undefined ? 'not-available' : 'value';
}

function pickSeries(resource: string, measure: ChoroplethMeasure): Series | undefined {
  const chapter = chapterFor(resource);
  if (!chapter) return undefined;
  return measure === 'reserves' ? reservesSeries(chapter) : primarySeries(chapter);
}

export function choropleth(
  resource: string,
  opts: { measure?: ChoroplethMeasure; year?: number; series?: string } = {},
): Choropleth | null {
  const measure = opts.measure ?? 'production';
  const chapter = chapterFor(resource);
  if (!chapter) return null;
  const series = opts.series
    ? seriesOf(chapter).find((s) => s.id === opts.series)
    : pickSeries(resource, measure);
  if (!series) return null;
  const year = opts.year && series.keys[opts.year] ? opts.year : Math.max(...series.years);
  const key = series.keys[year];
  const base = series.unit;
  const worldCell = worldRow(chapter)?.cells[key];
  const worldValue = numeric(worldCell, series.unit, base) ?? null;
  const shareable = worldValue !== null && worldValue > 0 && !worldCell?.moreThan;

  const rows = countryRows(chapter).filter((r) => r.iso2);
  const ranked = rows
    .map((r) => numeric(r.cells[key], series.unit, base))
    .filter((v): v is number => v !== undefined && v > 0)
    .sort((a, b) => b - a);

  const values: Record<string, ChoroplethValue> = {};
  for (const row of rows) {
    const cell = row.cells[key];
    const value = numeric(cell, series.unit, base) ?? null;
    const iso2 = row.iso2 as string;
    values[iso2] = {
      iso2,
      name: row.name,
      value,
      share: shareable && value !== null ? value / (worldValue as number) : null,
      rank: value !== null && value > 0 ? ranked.indexOf(value) + 1 : null,
      estimated: Boolean(cell?.estimated),
      status: statusOf(cell),
      text: cellText(cell),
      notes: [...new Set([...row.footnotes, ...(cell?.footnotes ?? [])])]
        .map((n) => chapter.footnotes[n])
        .filter((t): t is string => Boolean(t)),
    };
  }
  const shares = Object.values(values)
    .map((v) => v.share)
    .filter((s): s is number => s !== null && s > 0);

  return {
    resource,
    commodity: chapter.commodity,
    measure,
    series: series.id,
    label: series.label,
    unit: series.unit,
    unitLabel: UNIT_LABEL[series.unit] ?? series.unit,
    year,
    world: {
      value: worldValue,
      moreThan: Boolean(worldCell?.moreThan),
      text: cellText(worldCell),
    },
    values,
    max: ranked[0] ?? 0,
    hhi: shares.length ? shares.reduce((sum, s) => sum + s * s, 0) : null,
    source: {
      url: chapter.url,
      label: `USGS, ${USGS.edition}: ${chapter.commodity}`,
      edition: USGS.edition,
      table: chapter.table,
      retrieved: USGS.retrieved,
    },
  };
}

export function choroplethOptions(): {
  resource: string;
  commodity: string;
  measures: ChoroplethMeasure[];
}[] {
  return chapters().map((c) => ({
    resource: c.resource,
    commodity: c.commodity,
    measures: reservesSeries(c) ? ['production', 'reserves'] : ['production'],
  }));
}
