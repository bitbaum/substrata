/**
 * Official series: fetched from the agency into research_series_points, and
 * read back merged with the committed corpus.
 *
 * The BLS public API allows a limited number of keyless requests a day; one
 * request carrying every series, once a day, is far inside it.
 */
import {
  OFFICIAL_SERIES,
  agencyPage,
  type OfficialSeries,
} from '@/config/substrata-official-series';
import { database } from './db';
import type { DeskItem } from './desk';
import { seriesItems } from './desk-series';
import { corpusSeries, sortPoints, type Series } from './series';

const BLS_API = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';
/** Years back a fetch reaches. The keyless API serves up to ten per request. */
const YEARS_BACK = 9;

interface BlsRow {
  year: string;
  period: string;
  value: string;
  footnotes?: Array<{ code?: string }>;
}

export interface BlsPoint {
  period: string;
  value: number;
  preliminary: boolean;
}

/** Monthly rows only ("M01".."M12"); the annual average ("M13") is not a month. */
export function parseBls(rows: readonly BlsRow[]): BlsPoint[] {
  return rows.flatMap((row) => {
    const m = row.period.match(/^M(0[1-9]|1[0-2])$/);
    const value = Number(row.value);
    if (!m || !/^\d{4}$/.test(row.year) || !Number.isFinite(value)) return [];
    return [
      {
        period: `${row.year}-${m[1]}`,
        value,
        preliminary: (row.footnotes ?? []).some((f) => f.code === 'P'),
      },
    ];
  });
}

export interface SeriesRun {
  series: number;
  pointsNew: number;
  pointsRevised: number;
  failed: number;
}

export async function fetchOfficialSeries(now = new Date()): Promise<SeriesRun> {
  const db = database();
  const run = await db.query<{ id: string }>(
    'INSERT INTO research_series_runs DEFAULT VALUES RETURNING id',
  );
  const outcome: SeriesRun = { series: 0, pointsNew: 0, pointsRevised: 0, failed: 0 };
  const endYear = now.getUTCFullYear();
  try {
    const response = await fetch(BLS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seriesid: OFFICIAL_SERIES.map((s) => s.agencyId),
        startyear: String(endYear - YEARS_BACK),
        endyear: String(endYear),
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(String(response.status));
    const body = (await response.json()) as {
      status?: string;
      Results?: { series?: Array<{ seriesID: string; data: BlsRow[] }> };
    };
    if (body.status !== 'REQUEST_SUCCEEDED') throw new Error(body.status ?? 'no status');
    for (const returned of body.Results?.series ?? []) {
      const config = OFFICIAL_SERIES.find((s) => s.agencyId === returned.seriesID);
      if (!config || returned.data.length === 0) {
        outcome.failed += 1;
        continue;
      }
      outcome.series += 1;
      for (const p of parseBls(returned.data)) {
        // xmax = 0 on the returned row means it was inserted, not updated.
        const result = await db.query<{ inserted: boolean; changed: boolean }>(
          `INSERT INTO research_series_points (series, period, value, preliminary)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (series, period) DO UPDATE
             SET value = EXCLUDED.value, preliminary = EXCLUDED.preliminary, updated_at = now()
             WHERE research_series_points.value <> EXCLUDED.value
                OR research_series_points.preliminary <> EXCLUDED.preliminary
           RETURNING (xmax = 0) AS inserted, true AS changed`,
          [config.id, p.period, p.value, p.preliminary],
        );
        const row = result.rows[0];
        if (row?.inserted) outcome.pointsNew += 1;
        else if (row?.changed) outcome.pointsRevised += 1;
      }
    }
  } catch {
    outcome.failed = OFFICIAL_SERIES.length;
  }
  await db.query(
    `UPDATE research_series_runs
        SET finished_at = now(), series = $2, points_new = $3, points_revised = $4, failed = $5
      WHERE id = $1`,
    [run.rows[0].id, outcome.series, outcome.pointsNew, outcome.pointsRevised, outcome.failed],
  );
  return outcome;
}

export function toSeries(
  config: OfficialSeries,
  rows: readonly { period: string; value: number; preliminary: boolean; first_seen: Date }[],
  fetchedOn: string,
): Series {
  const source = agencyPage(config);
  return {
    id: config.id,
    bottleneck: config.bottleneck,
    metric: config.metric,
    unit: config.unit,
    geography: config.geography,
    kind: config.kind,
    direction: config.direction,
    describes: config.describes,
    origin: 'official',
    check: `Fetched from the ${config.agency} public API, series ${config.agencyId}; shown as published, not re-typed or reviewed`,
    checkedOn: fetchedOn,
    points: sortPoints(
      rows.map((row) => ({
        date: row.period,
        value: row.value,
        source,
        publisher: `US Bureau of Labor Statistics, ${config.agencyId}`,
        primary: true,
        preliminary: row.preliminary,
        firstSeen: row.first_seen.toISOString(),
      })),
    ),
  };
}

/** Official series with their stored points. Throws when the database cannot be read. */
export async function officialSeries(): Promise<Series[]> {
  const db = database();
  const [points, run] = await Promise.all([
    db.query<{
      series: string;
      period: string;
      value: number;
      preliminary: boolean;
      first_seen: Date;
    }>(
      'SELECT series, period, value, preliminary, first_seen FROM research_series_points ORDER BY series, period',
    ),
    db.query<{ finished_at: Date }>(
      'SELECT finished_at FROM research_series_runs WHERE finished_at IS NOT NULL AND series > 0 ORDER BY finished_at DESC LIMIT 1',
    ),
  ]);
  const fetchedOn = run.rows[0]?.finished_at.toISOString().slice(0, 10) ?? '';
  return OFFICIAL_SERIES.map((config) =>
    toSeries(
      config,
      points.rows.filter((row) => row.series === config.id),
      fetchedOn,
    ),
  ).filter((s) => s.points.length > 0);
}

export interface AllSeries {
  series: Series[];
  /** False when the official half could not be read: the page says so. */
  officialOk: boolean;
}

/** The corpus always; the official half when the database answers. */
export async function allSeries(): Promise<AllSeries> {
  try {
    return { series: [...corpusSeries(), ...(await officialSeries())], officialOk: true };
  } catch {
    return { series: corpusSeries(), officialOk: false };
  }
}

/** Desk rows for these rails: corpus always, official series when the database answers. */
export async function railSeriesItems(
  rails: readonly { slug: string; name: string }[],
): Promise<DeskItem[]> {
  const { series } = await allSeries();
  return seriesItems(series, new Map(rails.map((b) => [b.slug, b.name])));
}
