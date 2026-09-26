/**
 * Pure checks on dated numbers: the corpus series (research/series.json) and
 * the official BLS series declared in config.
 */
import { BOTTLENECKS } from '@/lib/bottlenecks';
import { corpusSeries } from '@/lib/series';
import { OFFICIAL_SERIES } from '@/config/substrata-official-series';
import { DATASETS } from '@/config/substrata-freshness';
import { ageDays } from '@/lib/freshness/status';
import { bottleneckHref, seriesHref } from '@/lib/links';
import { judge, type CheckResult } from './types';

const BOTTLENECK_SLUGS = new Set(BOTTLENECKS.map((b) => b.slug));
const WORDS: Record<string, number> = {
  no: 0,
  one: 1,
  two: 2,
  twice: 2,
  three: 3,
  four: 4,
  five: 5,
  fifth: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  double: 2,
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
};
/** Units a quote may state a number in relative to the series ("1.2 billion" for 1,200 million, "45%" for 0.45). */
const SCALES = [1, 1000, 0.001, 1e6, 1e-6, 1e9, 1e-9, 100, 0.01];

/** Every number a sentence states: digits in English or European grouping, and small number words. */
export function numbersIn(quote: string): number[] {
  const out: number[] = [];
  for (const [token] of quote.matchAll(/\d[\d,.]*\d|\d/g)) {
    for (const form of [token.replace(/,/g, ''), token.replace(/\./g, '').replace(',', '.')]) {
      const n = Number(form);
      if (Number.isFinite(n)) out.push(n);
    }
  }
  for (const [word, n] of Object.entries(WORDS)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(quote)) out.push(n);
  }
  if (/\ba (single|year|month|quarter)\b/i.test(quote)) out.push(1);
  return out;
}

/** Whether the quoted sentence carries the value, to half a percent, in any of the usual scales. */
export function quoteCarries(quote: string, value: number): boolean {
  const tolerance = Math.max(1e-9, Math.abs(value) * 0.005);
  return numbersIn(quote).some((n) => SCALES.some((k) => Math.abs(n * k - value) <= tolerance));
}

export function seriesChecks(now = new Date()): CheckResult[] {
  const series = corpusSeries();
  const points = series.flatMap((s) => s.points.map((p) => ({ s, p, row: `${s.id} ${p.date}` })));
  const maxAge = DATASETS.find((d) => d.id === 'series-quotes')?.maxAgeDays ?? 30;
  const held = new Set([...series, ...OFFICIAL_SERIES].map((s) => s.bottleneck));
  return [
    judge(
      {
        dataset: 'series',
        criterion: 'completeness',
        check: 'series/binding-now-has-number',
        label: 'Every bottleneck binding now has at least one key-number series',
      },
      BOTTLENECKS.filter((b) => b.horizon === 'now'),
      (b) =>
        held.has(b.slug)
          ? null
          : { row: b.name, problem: 'no series', page: bottleneckHref(b.slug) },
    ),
    judge(
      {
        dataset: 'series',
        criterion: 'provenance',
        check: 'series/point-source',
        label: 'Every point has a source URL, a quote, the publisher and the date it was published',
      },
      points,
      ({ s, p, row }) =>
        /^https?:\/\//.test(p.source) && (p.quote ?? '').length > 10 && p.publisher && p.published
          ? null
          : {
              row,
              problem: 'source, quote, publisher or publication date missing',
              link: p.source,
              page: seriesHref(s.id),
            },
    ),
    judge(
      {
        dataset: 'series',
        criterion: 'correctness',
        check: 'series/quote-carries-value',
        label: 'The quoted sentence states the value the point records',
      },
      points,
      ({ s, p, row }) =>
        quoteCarries(p.quote ?? '', p.value)
          ? null
          : {
              row,
              problem: `the quote does not state ${p.value}`,
              link: p.source,
              page: seriesHref(s.id),
            },
    ),
    judge(
      {
        dataset: 'series',
        criterion: 'consistency',
        check: 'series/bottleneck-exists',
        label: 'Every series belongs to a bottleneck that exists',
      },
      series,
      (s) =>
        BOTTLENECK_SLUGS.has(s.bottleneck)
          ? null
          : { row: s.id, problem: `unknown bottleneck ${s.bottleneck}` },
    ),
    judge(
      {
        dataset: 'series',
        criterion: 'freshness',
        check: 'series/quote-checked-recently',
        label: `Each series' quotes were re-read within ${maxAge} days`,
      },
      series,
      (s) =>
        ageDays(s.checkedOn, now) <= maxAge
          ? null
          : { row: s.id, problem: `last read ${s.checkedOn}`, page: seriesHref(s.id) },
    ),
    judge(
      {
        dataset: 'official-series',
        criterion: 'consistency',
        check: 'official-series/bottleneck-exists',
        label: 'Every official series belongs to a bottleneck that exists',
      },
      OFFICIAL_SERIES,
      (s) =>
        BOTTLENECK_SLUGS.has(s.bottleneck)
          ? null
          : { row: s.id, problem: `unknown bottleneck ${s.bottleneck}` },
    ),
    judge(
      {
        dataset: 'official-series',
        criterion: 'provenance',
        check: 'official-series/agency-id',
        label: 'Every official series names its agency series id, which is its source link',
      },
      OFFICIAL_SERIES,
      (s) =>
        /^[A-Z0-9]{8,}$/.test(s.agencyId)
          ? null
          : { row: s.id, problem: 'agency id is not a BLS series id', page: seriesHref(s.id) },
    ),
  ];
}

/** The public page for an official series id. */
export function blsUrl(agencyId: string): string {
  return `https://data.bls.gov/timeseries/${agencyId}`;
}
