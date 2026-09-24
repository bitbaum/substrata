/**
 * Dated numbers per bottleneck, as time series.
 *
 * A series is one metric, in one unit, for one geography, on one bottleneck —
 * "large power transformer lead time, weeks, US" — and each point on it is a
 * value FOR a period, with the page it came from and the sentence on that page
 * that carries the number. A point with no quote is a number nobody can check,
 * and the site has no place for those.
 *
 * Two origins, never blended into one claim:
 *
 * - `corpus` — points read from a public page and committed to
 *   `research/series.json`. The quote was checked against the fetched page
 *   (`scripts/research/check-series.ts`); `check` says by whom.
 * - `official` — points from an official statistical API (the US Bureau of
 *   Labor Statistics), fetched on a schedule into the database and shown as
 *   the agency published them. Nobody re-types them, so nobody reviews them;
 *   the UI says which agency and when it was fetched.
 *
 * Nothing here is interpolated. A gap between two points is drawn as a gap in
 * time, never as a value.
 */
import corpusFile from '../research/series.json';

export type SeriesKind =
  | 'lead-time'
  | 'price'
  | 'price-index'
  | 'capacity'
  | 'output'
  | 'backlog'
  | 'orders'
  | 'inventory'
  | 'trade'
  | 'queue'
  | 'workforce'
  | 'other';

export const KIND_LABEL: Record<SeriesKind, string> = {
  'lead-time': 'Lead time',
  price: 'Price',
  'price-index': 'Price index',
  capacity: 'Capacity',
  output: 'Output',
  backlog: 'Backlog',
  orders: 'Orders',
  inventory: 'Inventory',
  trade: 'Trade volume',
  queue: 'Queue',
  workforce: 'Workforce',
  other: 'Other',
};

/** Which way is bad news for the bottleneck, so a move can be read as tightening. */
export type Direction = 'up-tightens' | 'up-loosens' | 'neutral';

export interface SeriesPoint {
  /** The period the value is FOR: YYYY, YYYY-Qn, YYYY-MM or YYYY-MM-DD. */
  date: string;
  value: number;
  /**
   * When the source states a range ("80–210 weeks"), its lower end; `value`
   * is then the upper end, and both are shown. Never averaged into one number.
   */
  low?: number;
  /** The page it came from. For official series, the agency's page for the series. */
  source: string;
  publisher: string;
  /** When the source was published, where it says. */
  published?: string;
  /** The sentence (or table line) on the source that carries the number. */
  quote?: string;
  /** The publisher's own statement or statistic, rather than a report of it. */
  primary: boolean;
  note?: string;
  /** Official series: the agency marks the value preliminary. */
  preliminary?: boolean;
  /** Official series: when the value first reached the database. */
  firstSeen?: string;
}

export interface Series {
  id: string;
  /** Bottleneck slug. */
  bottleneck: string;
  metric: string;
  unit: string;
  geography: string;
  kind: SeriesKind;
  direction: Direction;
  /** What the series literally counts, where that is narrower or broader than the bottleneck. */
  describes?: string;
  origin: 'corpus' | 'official';
  /** Shown first on its bottleneck: the series that best answers "how bad is it now". */
  headline?: boolean;
  /** How the points were checked: who read them, and on what date. */
  check: string;
  checkedOn: string;
  points: SeriesPoint[];
}

type CorpusSeries = Omit<Series, 'origin' | 'points'> & { points: SeriesPoint[] };

const CORPUS: Series[] = (corpusFile.series as CorpusSeries[]).map((s) => ({
  ...s,
  origin: 'corpus' as const,
  points: sortPoints(s.points),
}));

/** Committed series, every bottleneck. */
export function corpusSeries(): Series[] {
  return CORPUS;
}

/**
 * Where a period sits on a time axis, in ms. A year is placed mid-year and a
 * quarter mid-quarter: a position for drawing, not a claim about the value.
 */
export function periodTime(date: string): number {
  const q = date.match(/^(\d{4})-Q([1-4])$/);
  if (q) return Date.UTC(Number(q[1]), (Number(q[2]) - 1) * 3 + 1, 15);
  const m = date.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (!m) return NaN;
  if (!m[2]) return Date.UTC(Number(m[1]), 6, 1);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, m[3] ? Number(m[3]) : 15);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2025", "Q2 2025", "Aug 2026", "3 Mar 2026". */
export function periodLabel(date: string): string {
  const q = date.match(/^(\d{4})-Q([1-4])$/);
  if (q) return `Q${q[2]} ${q[1]}`;
  const m = date.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (!m) return date;
  if (!m[2]) return m[1];
  const month = MONTHS[Number(m[2]) - 1];
  return m[3] ? `${Number(m[3])} ${month} ${m[1]}` : `${month} ${m[1]}`;
}

export function sortPoints(points: readonly SeriesPoint[]): SeriesPoint[] {
  return [...points].sort((a, b) => periodTime(a.date) - periodTime(b.date));
}

export interface Change {
  from: SeriesPoint;
  to: SeriesPoint;
  /** Fraction, signed: 0.12 is +12%. Undefined when the prior value is zero. */
  pct?: number;
  delta: number;
}

/** The latest point against the one before it. Undefined with fewer than two points. */
export function latestChange(series: Pick<Series, 'points'>): Change | undefined {
  const n = series.points.length;
  if (n < 2) return undefined;
  return changeBetween(series.points[n - 2], series.points[n - 1]);
}

export function changeBetween(from: SeriesPoint, to: SeriesPoint): Change {
  return {
    from,
    to,
    delta: to.value - from.value,
    pct: from.value === 0 ? undefined : (to.value - from.value) / Math.abs(from.value),
  };
}

/** "+12%", "−3.4%", "0%": one decimal below ten per cent, none above. */
export function formatPct(pct: number): string {
  const abs = Math.abs(pct * 100);
  const text = abs >= 10 ? abs.toFixed(0) : abs.toFixed(1).replace(/\.0$/, '');
  if (text === '0') return '0%';
  return `${pct > 0 ? '+' : '−'}${text}%`;
}

/** Values as the source gave them, grouped for reading; never rounded past what was stated. */
export function formatValue(value: number): string {
  return value.toLocaleString('en', { maximumFractionDigits: 3 });
}

/** A point's value as stated: "128", or "80–210" where the source gave a range. */
export function formatPoint(point: Pick<SeriesPoint, 'value' | 'low'>): string {
  return point.low !== undefined
    ? `${formatValue(point.low)}–${formatValue(point.value)}`
    : formatValue(point.value);
}

/** Whether a move is bad news, good news or neither for the bottleneck. */
export function effectOf(
  series: Pick<Series, 'direction'>,
  change: Change | undefined,
): 'tightens' | 'loosens' | 'neutral' {
  if (!change || change.delta === 0 || series.direction === 'neutral') return 'neutral';
  // A plan or forecast has not happened; it moves nothing yet.
  if (isPlanned(change.to)) return 'neutral';
  const up = change.delta > 0;
  return up === (series.direction === 'up-tightens') ? 'tightens' : 'loosens';
}

/**
 * A value for a period that has not started: a target, plan or forecast the
 * source stated. Shown, and labelled, never read as a measurement.
 */
export function isPlanned(point: Pick<SeriesPoint, 'date'>, now = Date.now()): boolean {
  const q = point.date.match(/^(\d{4})-Q([1-4])$/);
  const start = q
    ? Date.UTC(Number(q[1]), (Number(q[2]) - 1) * 3, 1)
    : Date.UTC(
        Number(point.date.slice(0, 4)),
        point.date.length > 4 ? Number(point.date.slice(5, 7)) - 1 : 0,
        point.date.length > 7 ? Number(point.date.slice(8, 10)) : 1,
      );
  return start > now;
}

/** The newest point that is not a plan: what "latest" means when ordering. */
export function lastActual(series: Pick<Series, 'points'>): SeriesPoint | undefined {
  return [...series.points].reverse().find((p) => !isPlanned(p));
}

/** A move at least this large, either way, is flagged on the desk. */
export const ALERT_PCT = 0.1;

export function seriesFor(all: readonly Series[], bottleneck: string): Series[] {
  return all.filter((s) => s.bottleneck === bottleneck && s.points.length > 0).sort(byRelevance);
}

/**
 * Headline series first, then those with a recent actual value and a history,
 * then everything else; plans and one-off figures sink.
 */
export function byRelevance(a: Series, b: Series): number {
  const recency = (s: Series) => {
    const p = lastActual(s);
    return p ? periodTime(p.date) : 0;
  };
  const year = 365 * 86_400_000;
  const score = (s: Series) =>
    (s.headline ? 4 : 0) +
    (s.points.length > 1 ? 2 : 0) +
    (recency(s) > Date.now() - 2 * year ? 1 : 0);
  return score(b) - score(a) || recency(b) - recency(a) || b.points.length - a.points.length;
}

export function seriesById(all: readonly Series[], id: string): Series | undefined {
  return all.find((s) => s.id === id);
}

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
