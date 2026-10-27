/**
 * Annual revenue and net income, five fiscal years, from the filer's XBRL:
 * the columns and the rows under them. Growth and margin are computed here,
 * never written. Pure.
 */
import type { FundamentalsResult } from '@/lib/market-data/fundamentals/read';
import type { FactPoint, MetricSeries } from '@/lib/market-data/fundamentals/xbrl';
import { formatChange } from '@/lib/market-data/prices/compute';

export interface FinancialYear {
  /** "FY2025": the fiscal year, labelled by the calendar year it ends in. */
  label: string;
  end: string;
  revenue: number | null;
  netIncome: number | null;
  revenueUrl?: string;
  netIncomeUrl?: string;
  /** Revenue on the year before, "+12.3%"; null for the first year shown or a gap. */
  growth: string | null;
  /** Net income ÷ revenue, "55.8%". */
  margin: string | null;
}

export interface FinancialsView {
  years: FinancialYear[];
  /** The reporting currency as tagged ("USD", "TWD"). */
  currency: string;
  /** Divide by this and print `scaleWord`: values are drawn in billions or millions. */
  scale: number;
  scaleWord: 'bn' | 'm' | '';
  source: { name: string; url: string };
}

const series = (fund: Exclude<FundamentalsResult, { unavailable: true }>, id: string) => {
  const m = fund.metrics.find((x) => x.metric === id);
  return m && !('unavailable' in m) ? (m as MetricSeries) : null;
};

const label = (p: FactPoint) => `FY${p.end.slice(0, 4)}`;

export function financialsView(fund: FundamentalsResult, years = 5): FinancialsView | string {
  if ('unavailable' in fund) return fund.reason;
  const revenue = series(fund, 'revenue');
  const income = series(fund, 'netIncome');
  if (!revenue && !income)
    return `${fund.entityName} has tagged neither revenue nor net income in an annual report.`;
  const byLabel = new Map<string, FinancialYear>();
  for (const p of revenue?.annual ?? [])
    byLabel.set(label(p), {
      label: label(p),
      end: p.end,
      revenue: p.value,
      netIncome: null,
      revenueUrl: p.url,
      growth: null,
      margin: null,
    });
  for (const p of income?.annual ?? []) {
    const row = byLabel.get(label(p)) ?? {
      label: label(p),
      end: p.end,
      revenue: null,
      netIncome: null,
      growth: null,
      margin: null,
    };
    byLabel.set(label(p), { ...row, netIncome: p.value, netIncomeUrl: p.url });
  }
  const all = [...byLabel.values()].sort((a, b) => (a.end < b.end ? -1 : 1));
  all.forEach((y, i) => {
    const prev = all[i - 1];
    if (prev?.revenue && y.revenue !== null && prev.revenue > 0)
      y.growth = formatChange(y.revenue / prev.revenue - 1);
    if (y.revenue && y.netIncome !== null && y.revenue > 0)
      y.margin = `${((y.netIncome / y.revenue) * 100).toFixed(1).replace('-', '−')}%`;
  });
  const shown = all.slice(-years);
  const top = Math.max(...shown.map((y) => Math.abs(y.revenue ?? y.netIncome ?? 0)));
  const [scale, scaleWord] =
    top >= 1e9 ? [1e9, 'bn' as const] : top >= 1e6 ? [1e6, 'm' as const] : [1, '' as const];
  return {
    years: shown,
    currency: (revenue ?? income)!.unit,
    scale,
    scaleWord,
    source: fund.source,
  };
}

/** A value in the view's scale, to one decimal: "130.5". */
export function scaled(v: number | null, view: FinancialsView): number | null {
  return v === null ? null : Math.round((v / view.scale) * 10) / 10;
}
