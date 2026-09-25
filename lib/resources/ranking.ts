/**
 * One resource, every country the table lists: the world ranking behind
 * /resources/[slug] and its CSV. Production and reserves side by side, each
 * with its computed share and rank, plus the OECD restriction count.
 */
import { resourceLabel } from '@/config/substrata-resources';
import { choropleth, type Choropleth } from './choropleth';
import { chapterFor, primarySeries, reservesSeries } from './usgs';
import { restrictionsOn } from './restrictions';

export interface RankingRow {
  iso2: string;
  name: string;
  production: {
    text: string;
    value: number | null;
    share: number | null;
    rank: number | null;
    estimated: boolean;
  };
  prior: { text: string; value: number | null } | null;
  reserves: {
    text: string;
    value: number | null;
    share: number | null;
    rank: number | null;
  } | null;
  restrictions: number;
  notes: string[];
}

export interface ResourceRanking {
  resource: string;
  label: string;
  production: Choropleth;
  priorYear: number | null;
  reserves: Choropleth | null;
  rows: RankingRow[];
}

export function resourceRanking(resource: string): ResourceRanking | null {
  const chapter = chapterFor(resource);
  if (!chapter) return null;
  const series = primarySeries(chapter);
  const production = choropleth(resource, { series: series.id });
  if (!production) return null;
  const priorYear =
    series.years.filter((y) => y < production.year).sort((a, b) => b - a)[0] ?? null;
  const prior = priorYear ? choropleth(resource, { series: series.id, year: priorYear }) : null;
  const res = reservesSeries(chapter);
  const reserves = res ? choropleth(resource, { series: res.id }) : null;
  const counts = new Map<string, number>();
  for (const m of restrictionsOn(resource)) counts.set(m.iso2, (counts.get(m.iso2) ?? 0) + 1);

  const isos = new Set([...Object.keys(production.values), ...Object.keys(reserves?.values ?? {})]);
  const rows: RankingRow[] = [...isos].map((iso2) => {
    const p = production.values[iso2];
    const r = reserves?.values[iso2];
    const before = prior?.values[iso2];
    return {
      iso2,
      name: p?.name ?? r?.name ?? iso2.toUpperCase(),
      production: p
        ? { text: p.text, value: p.value, share: p.share, rank: p.rank, estimated: p.estimated }
        : { text: 'not in the table', value: null, share: null, rank: null, estimated: false },
      prior: before ? { text: before.text, value: before.value } : null,
      reserves: r ? { text: r.text, value: r.value, share: r.share, rank: r.rank } : null,
      restrictions: counts.get(iso2) ?? 0,
      notes: [...new Set([...(p?.notes ?? []), ...(r?.notes ?? [])])],
    };
  });
  rows.sort(
    (a, b) =>
      (a.production.rank ?? 999) - (b.production.rank ?? 999) ||
      (a.reserves?.rank ?? 999) - (b.reserves?.rank ?? 999) ||
      a.name.localeCompare(b.name),
  );
  return { resource, label: resourceLabel(resource), production, priorYear, reserves, rows };
}

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The ranking as CSV: USGS/EIA values as printed, computed shares and ranks labelled as such. */
export function rankingCsv(ranking: ResourceRanking): string {
  const p = ranking.production;
  const head = [
    'iso2',
    'country',
    `${p.label} ${p.year} (${p.unitLabel})`,
    ...(ranking.priorYear ? [`${p.label} ${ranking.priorYear} (${p.unitLabel})`] : []),
    'estimated',
    'share of world (computed)',
    'rank (computed)',
    ...(ranking.reserves
      ? [
          `${ranking.reserves.label} (${ranking.reserves.unitLabel})`,
          'reserves share (computed)',
          'reserves rank (computed)',
        ]
      : []),
    'OECD export restrictions recorded',
    'notes',
  ];
  const lines = ranking.rows.map((r) =>
    [
      r.iso2,
      r.name,
      r.production.value ?? r.production.text,
      ...(ranking.priorYear ? [r.prior?.value ?? r.prior?.text ?? ''] : []),
      r.production.estimated ? 'yes' : '',
      r.production.share?.toFixed(4),
      r.production.rank,
      ...(ranking.reserves
        ? [
            r.reserves?.value ?? r.reserves?.text ?? '',
            r.reserves?.share?.toFixed(4),
            r.reserves?.rank,
          ]
        : []),
      r.restrictions,
      r.notes.join(' | '),
    ]
      .map(csvCell)
      .join(','),
  );
  const source = `# Source: ${p.source.label} — ${p.source.url} (table: ${p.source.table}). Shares and ranks computed by Substrata.`;
  return [source, head.map(csvCell).join(','), ...lines].join('\n') + '\n';
}
