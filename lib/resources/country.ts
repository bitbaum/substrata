/**
 * A country's resources, as numbers: for every table that lists the country,
 * its production (latest year and the one before), world rank and share,
 * reserves, and reserves-to-production — each value USGS's or EIA's, each
 * derived number computed here under a named method.
 *
 * Order is by significance: the country's largest share of world output
 * first, so Russia opens on palladium and nickel, not on a resource it merely
 * has. Resources the directory lists but no table covers are returned apart,
 * as "no production table", never as zero.
 */
import { resourceLabel, resourcesFor } from '@/config/substrata-resources';
import { choropleth, type ChoroplethValue } from './choropleth';
import {
  UNIT_LABEL,
  chapters,
  numeric,
  reservesPair,
  seriesOf,
  type Series,
  type UsgsChapter,
} from './usgs';

export interface SeriesFact {
  series: string;
  measure: 'production' | 'capacity' | 'reserves';
  label: string;
  unit: string;
  unitLabel: string;
  year: number;
  current: ChoroplethValue;
  /** Same series, the year before, when the table has it. */
  prior: { year: number; value: number | null; text: string } | null;
  /** Fractional change from prior to current; null unless both are positive numbers. */
  change: number | null;
  /** How many countries the table lists individually with a positive value. */
  listed: number;
  worldText: string;
}

export interface ResourceFacts {
  resource: string;
  label: string;
  commodity: string;
  source: { url: string; label: string; table: string; unitQuote: string };
  production: SeriesFact[];
  reserves: SeriesFact | null;
  /** Reserves ÷ latest production, same unit, when USGS gives a like-for-like pair. */
  reservesToProduction: { years: number; reservesYear: number; productionYear: number } | null;
  /** The share this ordering is ranked by (largest share on any production series), or null. */
  significance: number | null;
}

function priorOf(chapter: UsgsChapter, series: Series, year: number, iso2: string) {
  const earlier = series.years.filter((y) => y < year).sort((a, b) => b - a)[0];
  if (earlier === undefined) return null;
  const row = chapter.rows.find((r) => r.iso2 === iso2);
  const cell = row?.cells[series.keys[earlier]];
  const value = numeric(cell, series.unit, series.unit) ?? null;
  return {
    year: earlier,
    value,
    text: cell ? (value !== null ? value.toLocaleString('en') : cell.raw) : 'not in the table',
  };
}

function factFor(chapter: UsgsChapter, series: Series, iso2: string): SeriesFact | null {
  const map = choropleth(chapter.resource, { series: series.id });
  const current = map?.values[iso2];
  if (!map || !current) return null;
  const prior = series.measure === 'reserves' ? null : priorOf(chapter, series, map.year, iso2);
  const change =
    prior?.value && current.value && prior.value > 0 ? current.value / prior.value - 1 : null;
  return {
    series: series.id,
    measure: series.measure,
    label: series.label,
    unit: series.unit,
    unitLabel: UNIT_LABEL[series.unit] ?? series.unit,
    year: map.year,
    current,
    prior,
    change,
    listed: Object.values(map.values).filter((v) => (v.value ?? 0) > 0).length,
    worldText: map.world.text,
  };
}

/** The production series (not capacity) on which the country has its largest share. */
export function leadOf(production: SeriesFact[]): SeriesFact | undefined {
  return production
    .filter((p) => p.measure === 'production' && p.current.share !== null)
    .sort((a, b) => (b.current.share ?? 0) - (a.current.share ?? 0))[0];
}

export function resourceFacts(iso2: string, chapter: UsgsChapter): ResourceFacts | null {
  const id = iso2.toLowerCase();
  if (!chapter.rows.some((r) => r.iso2 === id)) return null;
  const all = seriesOf(chapter);
  const production = all
    .filter((s) => s.measure !== 'reserves')
    .map((s) => factFor(chapter, s, id))
    .filter((f): f is SeriesFact => f !== null)
    // The primary series first; the rest in table order.
    .sort((a, b) => Number(b.series === chapter.primary) - Number(a.series === chapter.primary));
  const pair = reservesPair(chapter);
  const reservesSeries = pair?.reserves ?? all.find((s) => s.measure === 'reserves');
  const reserves = reservesSeries ? factFor(chapter, reservesSeries, id) : null;

  let rp: ResourceFacts['reservesToProduction'] = null;
  if (pair) {
    const row = chapter.rows.find((r) => r.iso2 === id);
    const year = Math.max(...pair.production.years);
    const prod = numeric(
      row?.cells[pair.production.keys[year]],
      pair.production.unit,
      pair.production.unit,
    );
    const res = numeric(
      row?.cells[pair.reserves.keys[pair.reserves.years[0]]],
      pair.reserves.unit,
      pair.production.unit,
    );
    if (
      prod &&
      res &&
      prod > 0 &&
      !row?.cells[pair.reserves.keys[pair.reserves.years[0]]]?.moreThan
    )
      rp = { years: res / prod, reservesYear: pair.reserves.years[0], productionYear: year };
  }
  return {
    resource: chapter.resource,
    label: resourceLabel(chapter.resource),
    commodity: chapter.commodity,
    source: {
      url: chapter.url,
      label: `${chapter.source}, ${chapter.edition}`,
      table: chapter.table,
      unitQuote: chapter.unitQuote,
    },
    production,
    reserves,
    reservesToProduction: rp,
    // A country's weight on a resource is its largest share on any production
    // series (capacity is not output): Russia is minor in platinum and the
    // largest palladium miner.
    significance: leadOf(production)?.current.share ?? null,
  };
}

export interface CountryResources {
  measured: ResourceFacts[];
  /** Resources the directory names for the country that no production table lists it for. */
  unmeasured: { id: string; label: string; hasTable: boolean }[];
}

export function countryResources(iso2: string): CountryResources {
  const id = iso2.toLowerCase();
  const measured = chapters()
    .map((c) => resourceFacts(id, c))
    .filter((f): f is ResourceFacts => f !== null)
    .sort((a, b) => (b.significance ?? -1) - (a.significance ?? -1));
  const have = new Set(measured.map((m) => m.resource));
  const tables = new Set(chapters().map((c) => c.resource));
  const unmeasured = (resourcesFor(id)?.resources ?? [])
    .filter((r) => !have.has(r))
    .map((r) => ({ id: r, label: resourceLabel(r), hasTable: tables.has(r) }));
  return { measured, unmeasured };
}
