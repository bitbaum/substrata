/**
 * The board: every bottleneck as one row, grouped by the stage of the loop
 * it sits on, narrowed by links.
 *
 * Filters are links, not client state. The query lives in the URL (listkit
 * owns the codec), the page is a server component, and a reader can send a
 * narrowed board to someone as a link. No JavaScript is needed to use it.
 */

import React from 'react';
import Link from 'next/link';
import { writeQuery, type ListQuery, type ListResult, type ParamsLike } from 'listkit';

import { HORIZON_LABEL, type Horizon } from '@/config/substrata-assessment';
import { STAGES, type StageId } from '@/config/substrata-stages';
import { BOARD_SPEC, KIND_LABEL, STATE_LABEL, type Bottleneck } from '@/lib/bottlenecks';
import { Chip } from './Chip';
import { Progress, Status, rowLabel } from './Status';

/** Rows in loop order, one block per stage that has any. */
function groupByStage(rows: readonly Bottleneck[]): Array<[StageId, Bottleneck[]]> {
  return STAGES.map(
    (stage) => [stage.id, rows.filter((row) => row.stage === stage.id)] as [StageId, Bottleneck[]],
  ).filter(([, group]) => group.length > 0);
}

const COLUMNS = [
  { label: 'Bottleneck', className: '' },
  { label: 'Where', className: 'hidden md:table-cell' },
  { label: 'Producers', className: 'hidden md:table-cell' },
  { label: 'Binding', className: '' },
  { label: 'Horizon', className: 'hidden sm:table-cell' },
  { label: 'State', className: '' },
] as const;

const HORIZONS: Horizon[] = ['now', 'two-years', 'beyond'];

interface Props {
  params: ParamsLike;
  query: ListQuery;
  result: ListResult<Bottleneck>;
  /** Where the chips link back to. */
  basePath?: string;
}

/** 0–12 as a short bar plus the number. */
export function BindingBar({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono text-xs tabular-nums text-fg-primary">{value}</span>
      <span className="flex h-1.5 w-12 overflow-hidden rounded-full bg-border-subtle" aria-hidden>
        <span className="bg-accent" style={{ width: `${(value / 12) * 100}%` }} />
      </span>
    </span>
  );
}

export function Board({ params, query, result, basePath = '/board' }: Props) {
  const hrefFor = (next: ListQuery) => {
    const qs = writeQuery(params, next, BOARD_SPEC, query).toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const withFacet = (key: string, values: string[]): ListQuery => ({
    ...query,
    page: 1,
    facets: { ...query.facets, [key]: values },
  });
  const selected = (key: string) => query.facets[key] ?? [];
  const counts = (key: string) => result.counts[key] ?? {};

  return (
    <section>
      <div className="flex flex-col gap-3 border-y border-subtle py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 w-14 font-mono text-xs uppercase tracking-caps text-fg-tertiary">
            Stage
          </span>
          <Chip
            href={hrefFor(withFacet('stage', []))}
            active={selected('stage').length === 0}
            label="All"
          />
          {STAGES.filter(
            (s) => (counts('stage')[s.id] ?? 0) > 0 || selected('stage').includes(s.id),
          ).map((stage) => (
            <Chip
              key={stage.id}
              href={hrefFor(withFacet('stage', [stage.id]))}
              active={selected('stage').includes(stage.id)}
              label={stage.name}
              count={counts('stage')[stage.id] ?? 0}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 w-14 font-mono text-xs uppercase tracking-caps text-fg-tertiary">
              Horizon
            </span>
            <Chip
              href={hrefFor(withFacet('horizon', []))}
              active={selected('horizon').length === 0}
              label="All"
            />
            {HORIZONS.map((h) => (
              <Chip
                key={h}
                href={hrefFor(withFacet('horizon', [h]))}
                active={selected('horizon').includes(h)}
                label={HORIZON_LABEL[h]}
                count={counts('horizon')[h] ?? 0}
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
                count={counts('state')[state] ?? 0}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-strong">
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
            {groupByStage(result.rows).flatMap(([stageId, rows]) => {
              const stage = STAGES.find((s) => s.id === stageId)!;
              return [
                <tr key={`stage-${stageId}`} className="bg-surface-raised">
                  <th
                    scope="rowgroup"
                    colSpan={COLUMNS.length}
                    className="py-2 pr-4 text-left font-heading text-base font-semibold text-fg-primary"
                  >
                    {stage.name}
                    <span className="ml-3 font-mono text-xs font-normal text-fg-muted">
                      {rows.length}
                    </span>
                    <span className="ml-3 font-sans text-xs font-normal text-fg-tertiary">
                      relief {stage.reliefTime.toLowerCase()}
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
                    <td className="py-3 pr-4 align-top">
                      <BindingBar value={row.binding} />
                    </td>
                    <td className="hidden py-3 pr-4 align-top text-sm text-fg-secondary sm:table-cell">
                      {HORIZON_LABEL[row.horizon]}
                    </td>
                    <td className="py-3 align-top">
                      <Status state={row.state} compact label={rowLabel(row.counts)} />
                    </td>
                  </tr>
                )),
              ];
            })}
          </tbody>
        </table>
      </div>

      {result.rows.length === 0 && (
        <p className="py-10 text-center text-sm text-fg-tertiary">
          Nothing matches.{' '}
          <Link href={basePath} className="text-accent underline-offset-4 hover:underline">
            Clear the filters.
          </Link>
        </p>
      )}
      <p className="mt-3 font-mono text-xs text-fg-muted">
        {result.matched} of {result.total} · binding is the four mandate tests, 0–3 each, judged by
        an analyst and dated on every page
      </p>
    </section>
  );
}
