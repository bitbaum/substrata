/**
 * The board: every bottleneck as one row, narrowed by links.
 *
 * Filters are links, not client state. The query lives in the URL (listkit
 * owns the codec), the page is a server component, and a reader can send a
 * narrowed board to someone as a link. No JavaScript is needed to use it.
 */

import React from 'react';
import Link from 'next/link';
import { writeQuery, type ListQuery, type ListResult, type ParamsLike } from 'listkit';

import { MANDATE_CURVES, type CurveId } from '@/config/substrata';
import {
  BOARD_SPEC,
  CURVE_LABEL,
  KIND_LABEL,
  STATE_LABEL,
  type Bottleneck,
} from '@/lib/bottlenecks';
import { Progress, Status } from './Status';

const CURVE_TEST: Record<CurveId, string> = Object.fromEntries(
  MANDATE_CURVES.map((curve) => [curve.id, curve.test]),
) as Record<CurveId, string>;

/** Rows in mandate order, one block per curve that has any. */
function groupByCurve(rows: readonly Bottleneck[]): Array<[CurveId, Bottleneck[]]> {
  return MANDATE_CURVES.map(
    (curve) => [curve.id, rows.filter((row) => row.curve === curve.id)] as [CurveId, Bottleneck[]],
  ).filter(([, group]) => group.length > 0);
}

const COLUMNS = [
  { label: 'Bottleneck', className: '' },
  { label: 'Where', className: 'hidden md:table-cell' },
  { label: 'Producers', className: 'hidden md:table-cell' },
  { label: 'State', className: '' },
] as const;

interface ChipProps {
  href: string;
  active: boolean;
  label: string;
  count?: number;
}

function Chip({ href, active, label, count }: ChipProps) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={[
        'inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm transition-colors',
        active
          ? 'border-accent bg-accent text-surface-page'
          : 'border-strong text-fg-secondary hover:border-accent hover:text-fg-primary',
      ].join(' ')}
    >
      {label}
      {count !== undefined && (
        <span
          className={`font-mono text-xs tabular-nums ${active ? 'opacity-80' : 'text-fg-muted'}`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

interface Props {
  params: ParamsLike;
  query: ListQuery;
  result: ListResult<Bottleneck>;
}

export function Board({ params, query, result }: Props) {
  const hrefFor = (next: ListQuery) => {
    const qs = writeQuery(params, next, BOARD_SPEC, query).toString();
    return qs ? `/?${qs}` : '/';
  };
  const withFacet = (key: string, values: string[]): ListQuery => ({
    ...query,
    page: 1,
    facets: { ...query.facets, [key]: values },
  });
  const selected = (key: string) => query.facets[key] ?? [];

  const curveCounts = result.counts.curve ?? {};
  const stateCounts = result.counts.state ?? {};

  return (
    <section>
      <div className="flex flex-col gap-3 border-y border-subtle py-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 font-mono text-xs uppercase tracking-caps text-fg-tertiary">
            Curve
          </span>
          <Chip
            href={hrefFor(withFacet('curve', []))}
            active={selected('curve').length === 0}
            label="All"
          />
          {MANDATE_CURVES.map((curve) => (
            <Chip
              key={curve.id}
              href={hrefFor(withFacet('curve', [curve.id]))}
              active={selected('curve').includes(curve.id)}
              label={curve.label}
              count={curveCounts[curve.id] ?? 0}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 font-mono text-xs uppercase tracking-caps text-fg-tertiary">
            State
          </span>
          <Chip
            href={hrefFor(withFacet('state', []))}
            active={selected('state').length === 0}
            label="All"
          />
          {(['sourced', 'candidate', 'unverified'] as const).map((state) => (
            <Chip
              key={state}
              href={hrefFor(withFacet('state', [state]))}
              active={selected('state').includes(state)}
              label={STATE_LABEL[state]}
              count={stateCounts[state] ?? 0}
            />
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-strong">
              {/* Where and producer counts step aside on a phone: a name and a
                  state that fit beat four columns that scroll. */}
              {COLUMNS.map((column) => (
                <th
                  key={column.label}
                  scope="col"
                  className={`py-2.5 pr-4 font-mono text-xs font-medium uppercase tracking-caps text-fg-tertiary ${column.className}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {groupByCurve(result.rows).flatMap(([curve, rows]) => [
              // A heading row per curve instead of a column repeating the same
              // three words: the reader sees the three curves as three blocks.
              <tr key={`curve-${curve}`} className="bg-surface-raised">
                <th
                  scope="rowgroup"
                  colSpan={4}
                  className="py-2 pr-4 text-left font-heading text-base font-semibold text-fg-primary"
                >
                  {CURVE_LABEL[curve]}
                  <span className="ml-3 font-mono text-xs font-normal text-fg-muted">
                    {rows.length}
                  </span>
                  <span className="ml-3 font-sans text-xs font-normal text-fg-tertiary">
                    {CURVE_TEST[curve]}
                  </span>
                </th>
              </tr>,
              ...rows.map((row) => (
                <tr key={row.slug} className="group">
                  <td className="py-3 pr-4 align-top">
                    <Link
                      href={`/bottlenecks/${row.slug}`}
                      className="font-medium text-fg-primary underline-offset-4 group-hover:underline"
                    >
                      {row.name}
                    </Link>
                    <div className="mt-0.5 text-xs text-fg-tertiary">
                      {KIND_LABEL[row.kind]}
                      {row.area ? ` · ${row.area}` : ''}
                    </div>
                  </td>
                  <td className="hidden py-3 pr-4 align-top font-mono text-xs tabular-nums text-fg-secondary md:table-cell">
                    {row.jurisdictions.length ? row.jurisdictions.join(' ') : '—'}
                  </td>
                  <td className="hidden py-3 pr-4 align-top md:table-cell">
                    {row.producers.length > 0 ? (
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs tabular-nums text-fg-secondary">
                          {row.counts.total}
                        </span>
                        <Progress
                          sourced={row.counts.sourced}
                          candidate={row.counts.candidate}
                          total={row.counts.total}
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-fg-muted">Single node</span>
                    )}
                  </td>
                  <td className="py-3 align-top">
                    <Status state={row.state} />
                  </td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>

      {result.rows.length === 0 && (
        <p className="py-10 text-center text-sm text-fg-tertiary">
          Nothing matches.{' '}
          <Link href="/" className="text-accent underline-offset-4 hover:underline">
            Clear the filters.
          </Link>
        </p>
      )}
      <p className="mt-3 font-mono text-xs text-fg-muted">
        {result.matched} of {result.total}
      </p>
    </section>
  );
}
