/** A series as CSV, provenance on every row. Split from lib/series.ts by job. */
import type { Series } from './series';

function csvCell(value: string | number | boolean | undefined): string {
  const text = value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** One series as CSV: one row per point, provenance on every row. */
export function seriesCsv(series: Series): string {
  const header = [
    'series',
    'bottleneck',
    'metric',
    'unit',
    'geography',
    'period',
    'value',
    'origin',
    'primary',
    'preliminary',
    'publisher',
    'published',
    'source',
    'quote',
    'note',
  ];
  const rows = series.points.map((p) =>
    [
      series.id,
      series.bottleneck,
      series.metric,
      series.unit,
      series.geography,
      p.date,
      p.value,
      series.origin,
      p.primary,
      p.preliminary ?? false,
      p.publisher,
      p.published,
      p.source,
      p.quote,
      p.note,
    ]
      .map(csvCell)
      .join(','),
  );
  return `${[header.join(','), ...rows].join('\n')}\n`;
}
