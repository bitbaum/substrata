import { connection } from 'next/server';
import { ColumnChart } from '@bitbaum/chartkit/react';

import { NO_LISTING_SHORT } from '@/lib/market-data/company';
import { financialsView, scaled } from '@/lib/company-page/financials';
import { fundamentalsOf, listingOf } from '@/lib/company-page/load';
import { bigNumber } from '@/lib/market-data/present';
import { EmptyState, SourceNote } from './parts';

const SOURCES = [
  'SEC EDGAR XBRL company facts (10-K, 20-F, 40-F)',
  'an annual report with a page locator, through scripts/research/add.ts',
] as const;

const fmt = (v: number | null, unit: string) =>
  v === null ? '—' : `${v < 0 ? '−' : ''}${bigNumber(Math.abs(v))} ${unit}`;

/** Revenue and net income, five fiscal years: columns, then a row per year. */
export async function Financials({ slug, name }: { slug: string; name: string }) {
  await connection();
  const c = listingOf(slug);
  if (!c)
    return (
      <EmptyState
        name={name}
        missing={NO_LISTING_SHORT}
        sources={SOURCES}
        topic="financial statements"
      />
    );
  const fund = await fundamentalsOf(slug);
  const view = financialsView(fund!);
  if (typeof view === 'string')
    return <EmptyState name={name} missing={view} sources={SOURCES} topic="financial statements" />;
  const unit = `${view.currency}${view.scaleWord ? ` ${view.scaleWord}` : ''}`;
  return (
    <>
      <ColumnChart
        series={[
          {
            id: 'revenue',
            label: 'Revenue',
            points: view.years.map((y) => ({
              x: y.label,
              y: scaled(y.revenue, view),
              href: y.revenueUrl,
            })),
          },
          {
            id: 'net-income',
            label: 'Net income',
            points: view.years.map((y) => ({
              x: y.label,
              y: scaled(y.netIncome, view),
              href: y.netIncomeUrl,
            })),
          },
        ]}
        unit={unit}
        caption={`${name}: annual revenue and net income, ${unit}, fiscal years labelled by the year they end in. Each column links to the filing it was read from.`}
      />
      <table className="mk-table mk-fin">
        <caption className="mk-label">By fiscal year</caption>
        <thead>
          <tr>
            <th scope="col">Year</th>
            <th scope="col">Revenue</th>
            <th scope="col">Growth</th>
            <th scope="col">Net income</th>
            <th scope="col">Net margin</th>
          </tr>
        </thead>
        <tbody>
          {[...view.years].reverse().map((y) => (
            <tr key={y.label}>
              <th scope="row">
                {y.label} <span className="mk-figure-detail">to {y.end}</span>
              </th>
              <td data-label="Revenue">{fmt(y.revenue, view.currency)}</td>
              <td data-label="Growth">{y.growth ?? '—'}</td>
              <td data-label="Net income">{fmt(y.netIncome, view.currency)}</td>
              <td data-label="Net margin">{y.margin ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <SourceNote>
        From{' '}
        <a href={view.source.url} rel="noreferrer">
          {view.source.name} ↗
        </a>
        , as last reported (restatements included). Growth and margin are computed here.
      </SourceNote>
    </>
  );
}
