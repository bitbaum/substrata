/**
 * Company fundamentals from SEC EDGAR's XBRL "company facts" API:
 * `https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json` — every
 * number a filer has tagged in its 10-K, 10-Q, 20-F or 40-F, with the period,
 * the form and the accession number of the filing it was read from.
 *
 * Pure: this file turns that JSON into the series a page or the Ask shows.
 * Rules:
 *   - A metric is a list of candidate concepts (filers switch: NVIDIA tags
 *     `Revenues`, AMD `RevenueFromContractWithCustomerExcludingAssessedTax`;
 *     TSMC, Rio Tinto and Cameco file IFRS, `ifrs-full:Revenue`). Each POINT
 *     carries the concept it was read from, so a switch is visible.
 *   - Annual: an annual form, a duration of 330–400 days. Quarterly: a 10-Q,
 *     80–100 days. Fourth quarters are not filed as quarters, so they are not
 *     shown — never derived here as year minus three quarters.
 *   - A period reported by several filings (as a comparative next year) takes
 *     the most recently filed figure, i.e. as last reported, restatements
 *     included; its accession is the one cited.
 *   - Money stays in the filer's reporting currency (TSMC in TWD, ASML in
 *     EUR) — the unit with the most facts. Nothing is converted, and a
 *     filer's own convenience translation into dollars is not used.
 *   - What a filer did not tag is a typed `unavailable` with the reason.
 */
import { METRICS, type MetricId, type MetricSpec } from './metrics';

export { METRICS, type MetricId } from './metrics';

export const companyFactsUrl = (cik: number) =>
  `https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10, '0')}.json`;

export const filingIndexUrl = (cik: number, accession: string) =>
  `https://www.sec.gov/Archives/edgar/data/${cik}/${accession.replace(/-/g, '')}/${accession}-index.htm`;

interface RawFact {
  start?: string;
  end: string;
  val: number;
  accn: string;
  fy?: number;
  fp?: string;
  form: string;
  filed: string;
}

export interface CompanyFacts {
  cik: number;
  entityName: string;
  facts: Record<string, Record<string, { units: Record<string, RawFact[]> }>>;
}

export interface FactPoint {
  /** Period start (durations only) and end, YYYY-MM-DD. */
  start?: string;
  end: string;
  value: number;
  form: string;
  /** Fiscal period as the filing labels it: FY, Q1–Q3. */
  fiscalPeriod: string;
  accession: string;
  filed: string;
  /** The filing on EDGAR. */
  url: string;
  /** "us-gaap:Revenues" — what was read. */
  concept: string;
  /** Set when one filing tagged several values for the date (one per share class) and they were summed. */
  note?: string;
}

export interface MetricSeries {
  metric: MetricId;
  label: string;
  unit: string;
  annual: FactPoint[];
  quarterly: FactPoint[];
}

export interface MetricUnavailable {
  metric: MetricId;
  label: string;
  unavailable: true;
  reason: string;
}

export type MetricResult = MetricSeries | MetricUnavailable;

const ANNUAL_FORMS = /^(10-K|20-F|40-F)(\/A)?$/;
const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;

function factsFor(cf: CompanyFacts, concept: string): { unit: string; rows: RawFact[] } | null {
  const [ns, name] = concept.split(':');
  const units = cf.facts[ns]?.[name]?.units;
  if (!units) return null;
  // The reporting currency is the unit with the most facts; a 20-F's second
  // currency (TSMC's US-dollar figures) is a convenience translation of a few.
  const unit = Object.keys(units).sort((a, b) => units[b].length - units[a].length)[0] ?? '';
  return unit ? { unit, rows: units[unit] } : null;
}

function pick(
  cf: CompanyFacts,
  spec: MetricSpec,
  concept: string,
  rows: RawFact[],
  annual: boolean,
): FactPoint[] {
  const keep = rows.filter((r) => {
    if (annual ? !ANNUAL_FORMS.test(r.form) : !/^10-Q(\/A)?$/.test(r.form)) return false;
    if (spec.kind === 'instant') return spec.id === 'sharesOutstanding' || !r.start;
    if (!r.start) return false;
    const d = days(r.start, r.end);
    return annual ? d >= 330 && d <= 400 : d >= 80 && d <= 100;
  });
  // Several values for one date in one filing: one per share class (cover page). Summed, and said.
  const byFiling = new Map<string, RawFact[]>();
  for (const r of keep) {
    const k = `${r.accn}|${r.start ?? ''}|${r.end}`;
    byFiling.set(k, [...(byFiling.get(k) ?? []), r]);
  }
  const byPeriod = new Map<string, FactPoint>();
  for (const group of byFiling.values()) {
    const r = group[0];
    const distinct = [...new Set(group.map((g) => g.val))];
    const value = spec.id === 'sharesOutstanding' ? distinct.reduce((s, v) => s + v, 0) : r.val;
    if (spec.id !== 'sharesOutstanding' && distinct.length > 1) continue; // ambiguous: not shown
    const point: FactPoint = {
      ...(r.start ? { start: r.start } : {}),
      end: r.end,
      value,
      form: r.form,
      fiscalPeriod: r.fp ?? '',
      accession: r.accn,
      filed: r.filed,
      url: filingIndexUrl(cf.cik, r.accn),
      concept,
      ...(distinct.length > 1
        ? { note: `sum of ${distinct.length} share classes tagged in this filing` }
        : {}),
    };
    const key = spec.id === 'sharesOutstanding' ? r.accn : `${r.start ?? ''}|${r.end}`;
    const seen = byPeriod.get(key);
    if (!seen || seen.filed < point.filed) byPeriod.set(key, point);
  }
  return [...byPeriod.values()];
}

function merge(lists: FactPoint[][], max: number): FactPoint[] {
  const byPeriod = new Map<string, FactPoint>();
  for (const list of lists)
    for (const p of list) {
      const key = `${p.start ?? ''}|${p.end}`;
      if (!byPeriod.has(key)) byPeriod.set(key, p);
    }
  return [...byPeriod.values()].sort((a, b) => (a.end < b.end ? -1 : 1)).slice(-max);
}

/** One metric's annual and quarterly series, or why there is none. */
export function metricSeries(
  cf: CompanyFacts,
  spec: MetricSpec,
  maxAnnual = 10,
  maxQuarterly = 12,
): MetricResult {
  const found = spec.concepts
    .map((concept) => ({ concept, f: factsFor(cf, concept) }))
    .filter((x): x is { concept: string; f: { unit: string; rows: RawFact[] } } => x.f !== null)
    // The concept the filer uses now comes first; older ones fill earlier periods.
    .sort((a, b) => (latestEnd(b.f.rows) > latestEnd(a.f.rows) ? 1 : -1));
  if (!found.length)
    return {
      metric: spec.id,
      label: spec.label,
      unavailable: true,
      reason: `${cf.entityName} has not tagged ${spec.concepts.map((c) => c.split(':')[1]).join(' or ')} in its XBRL filings`,
    };
  const unit = found[0].f.unit;
  const same = found.filter((x) => x.f.unit === unit);
  const annual = merge(
    same.map((x) => pick(cf, spec, x.concept, x.f.rows, true)),
    maxAnnual,
  );
  const quarterly = merge(
    same.map((x) => pick(cf, spec, x.concept, x.f.rows, false)),
    maxQuarterly,
  );
  if (!annual.length && !quarterly.length)
    return {
      metric: spec.id,
      label: spec.label,
      unavailable: true,
      reason: `${cf.entityName} tagged ${found[0].concept} but in no annual or quarterly report period`,
    };
  return { metric: spec.id, label: spec.label, unit, annual, quarterly };
}

const latestEnd = (rows: RawFact[]) => rows.reduce((m, r) => (r.end > m ? r.end : m), '');

export function allMetrics(cf: CompanyFacts): MetricResult[] {
  return METRICS.map((spec) => metricSeries(cf, spec));
}

export interface Growth {
  from: FactPoint;
  to: FactPoint;
  change: number;
  /** "+114.2%" — copy as is. */
  display: string;
}

/** Year-on-year change between consecutive fiscal years, computed in code. */
export function annualGrowth(series: MetricSeries): Growth[] {
  const out: Growth[] = [];
  for (let i = 1; i < series.annual.length; i++) {
    const [a, b] = [series.annual[i - 1], series.annual[i]];
    if (a.value <= 0 || days(a.end, b.end) < 330 || days(a.end, b.end) > 400) continue;
    const change = b.value / a.value - 1;
    const pct = Math.round(change * 1000) / 10;
    out.push({
      from: a,
      to: b,
      change,
      display: `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%`,
    });
  }
  return out;
}
