/**
 * The key-statistics grid: one cell per figure, each the latest ANNUAL value
 * from the filer's XBRL with its fiscal year, its growth and the filing it was
 * read from — or a cell that says why there is no figure. Pure.
 */
import { bigNumber, marketCap } from '@/lib/market-data/present';
import type { MarketCompany } from '@/lib/market-data/identity';
import type { FundamentalsResult } from '@/lib/market-data/fundamentals/read';
import {
  annualGrowth,
  type FactPoint,
  type MetricId,
  type MetricResult,
  type MetricSeries,
} from '@/lib/market-data/fundamentals/xbrl';
import type { PriceHistory, PriceUnavailable } from '@/lib/market-data/prices/series';

export interface StatCell {
  id: string;
  label: string;
  /** The figure, or "Not computed" / "Not reported". */
  value: string;
  /** Period, growth, or the reason there is no figure. */
  detail: string;
  /** The filing (or price page) the figure was read from. */
  href?: string;
  missing?: true;
}

/**
 * The cells, in the order the grid shows them: with market value, eight —
 * two rows of four, four rows of two, never a cell left hanging. Market value
 * is computed; the rest are read.
 */
export const STAT_METRICS: readonly { id: MetricId; label: string }[] = [
  { id: 'revenue', label: 'Revenue' },
  { id: 'operatingIncome', label: 'Operating income' },
  { id: 'netIncome', label: 'Net income' },
  { id: 'researchAndDevelopment', label: 'Research and development' },
  { id: 'capex', label: 'Capital expenditure' },
  { id: 'cash', label: 'Cash and equivalents' },
  { id: 'longTermDebt', label: 'Long-term debt' },
];

const isSeries = (m: MetricResult | undefined): m is MetricSeries =>
  Boolean(m) && !('unavailable' in m!);

/** "FY2025" for the fiscal year ending in 2025, or "31 Jan 2026" for a balance-sheet date. */
export function periodLabel(p: FactPoint, instant: boolean): string {
  return instant ? `at ${p.end}` : `FY${p.end.slice(0, 4)} (year to ${p.end})`;
}

function metricCell(id: MetricId, label: string, m: MetricResult | undefined): StatCell {
  if (!isSeries(m))
    return {
      id,
      label,
      value: 'Not reported',
      detail: m && 'reason' in m ? `${m.reason}.` : 'Not in the filer’s XBRL.',
      missing: true,
    };
  const last = m.annual.at(-1);
  if (!last)
    return {
      id,
      label,
      value: 'Not reported',
      detail: 'Tagged only in quarterly reports; no annual figure.',
      missing: true,
    };
  const instant = !last.start;
  const growth = annualGrowth(m).at(-1);
  const signed = last.value < 0 ? `−${bigNumber(-last.value)}` : bigNumber(last.value);
  return {
    id,
    label,
    value: `${signed} ${m.unit}`,
    detail: `${periodLabel(last, instant)}${growth && growth.to.end === last.end ? ` · ${growth.display} on the year before` : ''} · ${last.form}`,
    href: last.url,
  };
}

export function keyStatCells(
  company: MarketCompany,
  fund: FundamentalsResult,
  prices: PriceHistory | PriceUnavailable,
): { cells: StatCell[]; unavailable: string | null } {
  if ('unavailable' in fund) return { cells: [], unavailable: fund.reason };
  const byId = new Map(fund.metrics.map((m) => [m.metric, m]));
  const shares = byId.get('sharesOutstanding');
  let cap: StatCell;
  if ('unavailable' in prices)
    cap = {
      id: 'marketCap',
      label: 'Market value',
      value: 'Not computed',
      detail: `No price to multiply: ${prices.reason}`,
      missing: true,
    };
  else {
    const line = marketCap(
      company,
      prices,
      isSeries(shares) ? shares.annual.concat(shares.quarterly) : [],
    );
    cap =
      typeof line === 'string'
        ? {
            id: 'marketCap',
            label: 'Market value',
            value: 'Not computed',
            detail: line.replace(/^Not computed: /, ''),
            missing: true,
          }
        : {
            id: 'marketCap',
            label: 'Market value',
            value: `${bigNumber(line.close.value * line.shares.value)} ${prices.currency}`,
            detail: `close on ${line.close.date} × ${line.shares.value.toLocaleString('en-US')} shares on the cover dated ${line.shares.date}`,
            href: line.shares.url,
          };
  }
  return {
    cells: [cap, ...STAT_METRICS.map((s) => metricCell(s.id, s.label, byId.get(s.id)))],
    unavailable: null,
  };
}
