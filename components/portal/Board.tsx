/**
 * The bottleneck table: one row each, grouped by the stage of the loop it
 * sits on, narrowed by links.
 *
 * Filters are links, not client state. The query lives in the URL (listkit
 * owns the codec), the page is a server component, and a reader can send a
 * narrowed view to someone as a link. No JavaScript is needed to use it.
 *
 * Every row carries a plain-English line under its name, because the names
 * themselves are trade jargon and a reader should not have to open a page to
 * find out whether a row is about steel or about software.
 */

import React from 'react';
import Link from 'next/link';
import { writeQuery, type ListQuery, type ListResult, type ParamsLike } from 'listkit';

import type { Horizon } from '@/config/substrata-assessment';
import { STAGES, type StageId } from '@/config/substrata-stages';
import { INDUSTRIES, TECHNOLOGIES } from '@/config/substrata-taxonomy';
import { BOARD_SPEC, type Bottleneck } from '@/lib/bottlenecks';
import { EVIDENCE, EVIDENCE_LABEL, SEVERITY, WHEN, WHEN_LABEL } from '@/lib/labels';
import { Chip } from './Chip';
import { FilterRow, Legend } from './Shell';
import { Progress, SeverityBar, Status, rowLabel } from './Status';

function groupByStage(rows: readonly Bottleneck[]): Array<[StageId, Bottleneck[]]> {
  return STAGES.map(
    (stage) => [stage.id, rows.filter((row) => row.stage === stage.id)] as [StageId, Bottleneck[]],
  ).filter(([, group]) => group.length > 0);
}

const COLUMNS = [
  { label: 'Bottleneck', className: '' },
  { label: 'Where', className: 'hidden lg:table-cell' },
  { label: 'Makers', className: 'hidden md:table-cell' },
  { label: SEVERITY.label, className: '' },
  { label: WHEN.label, className: 'hidden sm:table-cell' },
  { label: EVIDENCE.label, className: '' },
] as const;

const HORIZONS: Horizon[] = ['now', 'two-years', 'beyond'];

const LEGEND = [
  { term: SEVERITY.label, detail: SEVERITY.long },
  { term: WHEN.label, detail: WHEN.long },
  { term: EVIDENCE.label, detail: EVIDENCE.long },
  {
    term: 'Makers',
    detail:
      'How many organisations are mapped as making this, and how much of that list is verified. ' +
      'A single node — a machine, a queue, a skill — has no maker list.',
  },
];

interface Props {
  params: ParamsLike;
  query: ListQuery;
  result: ListResult<Bottleneck>;
  basePath?: string;
}

export function Board({ params, query, result, basePath = '/bottlenecks' }: Props) {
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

  const chips = (
    key: string,
    options: readonly { id: string; name: string }[],
    hideEmpty = true,
  ) => (
    <>
      <Chip href={hrefFor(withFacet(key, []))} active={selected(key).length === 0} label="All" />
      {options
        .filter((o) => !hideEmpty || (counts(key)[o.id] ?? 0) > 0 || selected(key).includes(o.id))
        .map((o) => (
          <Chip
            key={o.id}
            href={hrefFor(withFacet(key, [o.id]))}
            active={selected(key).includes(o.id)}
            label={o.name}
            count={counts(key)[o.id] ?? 0}
          />
        ))}
    </>
  );

  return (
    <section>
      <form method="GET" action={basePath} className="research-search mb-4">
        {Object.entries(query.facets).map(([key, values]) =>
          values.length > 0 ? (
            <input key={key} type="hidden" name={key} value={values.join(',')} />
          ) : null,
        )}
        <label htmlFor="board-search" className="sr-only">
          Search bottlenecks
        </label>
        <input
          id="board-search"
          name="q"
          type="search"
          defaultValue={query.q}
          placeholder="Search a material, company or technology"
        />
        <button type="submit">Search</button>
        <Link href={basePath} className="text-sm text-accent">
          Clear all
        </Link>
      </form>
      <details className="mb-6" open={Object.values(query.facets).some((v) => v.length > 0)}>
        <summary className="cursor-pointer py-3 text-sm text-fg-secondary">
          Refine by technology, industry, stage or evidence · {result.matched} matches
        </summary>
        <div className="flex flex-col gap-3 border-y border-subtle py-4">
          <FilterRow label="Technology">
            {chips(
              'tech',
              TECHNOLOGIES.map((t) => ({ id: t.id, name: t.name })),
            )}
          </FilterRow>
          <FilterRow label="Industry">
            {chips(
              'industry',
              INDUSTRIES.map((i) => ({ id: i.id, name: i.name })),
            )}
          </FilterRow>
          <FilterRow label="Stage">
            {chips(
              'stage',
              STAGES.map((s) => ({ id: s.id, name: s.name })),
            )}
          </FilterRow>
          <FilterRow label={WHEN.label}>
            {chips(
              'horizon',
              HORIZONS.map((h) => ({ id: h, name: WHEN_LABEL[h] })),
              false,
            )}
          </FilterRow>
          <FilterRow label={EVIDENCE.label}>
            {chips(
              'state',
              (['sourced', 'candidate', 'unverified'] as const).map((s) => ({
                id: s,
                name: EVIDENCE_LABEL[s],
              })),
              false,
            )}
          </FilterRow>
        </div>
      </details>
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
              const stage = STAGES.find((s) => s.id === stageId);
              return [
                <tr key={`stage-${stageId}`} className="bg-surface-raised">
                  <th
                    scope="rowgroup"
                    colSpan={COLUMNS.length}
                    className="py-2 pr-4 text-left font-heading text-base font-semibold text-fg-primary"
                  >
                    {stage?.name}
                    <span className="ml-3 font-mono text-xs font-normal text-fg-muted">
                      {rows.length}
                    </span>
                    <span className="ml-3 font-sans text-xs font-normal text-fg-tertiary">
                      takes {stage?.reliefTime.toLowerCase()} to loosen
                    </span>
                  </th>
                </tr>,
                ...rows.map((row) => (
                  <tr key={row.slug} className="group align-top">
                    <td className="max-w-md py-3 pr-4">
                      <Link
                        href={`/bottlenecks/${row.slug}`}
                        className="font-medium text-fg-primary underline-offset-4 group-hover:underline"
                      >
                        {row.name}
                      </Link>
                      <p className="mt-0.5 text-xs leading-snug text-fg-tertiary">{row.plain}</p>
                    </td>
                    <td className="hidden py-3 pr-4 font-mono text-xs tabular-nums text-fg-secondary lg:table-cell">
                      {row.jurisdictions.length ? row.jurisdictions.join(' ') : '—'}
                    </td>
                    <td className="hidden py-3 pr-4 md:table-cell">
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
                    <td className="py-3 pr-4">
                      <SeverityBar value={row.binding} />
                    </td>
                    <td className="hidden py-3 pr-4 text-sm text-fg-secondary sm:table-cell">
                      {WHEN_LABEL[row.horizon]}
                    </td>
                    <td className="py-3">
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
          Nothing matches those filters.{' '}
          <Link href={basePath} className="text-accent underline-offset-4 hover:underline">
            Clear them
          </Link>
          .
        </p>
      )}
      <p className="mt-3 font-mono text-xs text-fg-muted">
        {result.matched} of {result.total}
      </p>
      <Legend items={LEGEND} />
    </section>
  );
}
