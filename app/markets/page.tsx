import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { applyQuery, parseQuery, writeQuery, type ListQuery } from 'listkit';

import { CHAIN_LAYERS, SCARCITY_DETAIL, type ChainLayer } from '@/config/substrata-participants';
import { INDUSTRIES } from '@/config/substrata-taxonomy';
import {
  MARKET_PARTICIPANTS,
  MARKET_SPEC,
  SCARCITY_LABEL,
  marketTotals,
  type MarketParticipant,
} from '@/lib/participants';
import { Chip } from '@/components/portal/Chip';
import { FilterRow, Legend, Page, SectionHeader, Shell } from '@/components/portal/Shell';
import { Status } from '@/components/portal/Status';

export const metadata: Metadata = {
  title: 'Markets',
  description:
    'The organisations that make the constrained things, ore to buyer, graded by how hard each would be to replace.',
};

type SearchParams = Record<string, string | string[] | undefined>;

const GRADE_DOT: Record<string, string> = {
  chokepoint: 'bg-status-negative',
  concentrated: 'bg-status-warning',
  competitive: 'bg-status-positive',
};

function Grade({ grade }: { grade: MarketParticipant['scarcity'] }) {
  if (!grade) return <span className="text-xs text-fg-muted">Not graded</span>;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-fg-secondary">
      <span
        aria-hidden
        className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${GRADE_DOT[grade]}`}
      />
      {SCARCITY_LABEL[grade]}
    </span>
  );
}

export default async function MarketsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = parseQuery(params, MARKET_SPEC);
  const result = applyQuery(MARKET_PARTICIPANTS, MARKET_SPEC, query);
  const totals = marketTotals();

  const hrefFor = (next: ListQuery) => {
    const qs = writeQuery(params, next, MARKET_SPEC, query).toString();
    return qs ? `/markets?${qs}` : '/markets';
  };
  const withFacet = (key: string, values: string[]): ListQuery => ({
    ...query,
    page: 1,
    facets: { ...query.facets, [key]: values },
  });
  const selected = (key: string) => query.facets[key] ?? [];
  const counts = (key: string) => result.counts[key] ?? {};

  const chips = (key: string, options: readonly { id: string; name: string }[]) => (
    <>
      <Chip href={hrefFor(withFacet(key, []))} active={selected(key).length === 0} label="All" />
      {options
        .filter((o) => (counts(key)[o.id] ?? 0) > 0 || selected(key).includes(o.id))
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

  const byLayer = CHAIN_LAYERS.map(
    (layer) =>
      [layer, result.rows.filter((row) => row.layer === layer.id)] as [
        (typeof CHAIN_LAYERS)[number],
        MarketParticipant[],
      ],
  ).filter(([, rows]) => rows.length > 0);

  return (
    <Shell currentPath="markets">
      <Page>
        <SectionHeader
          title="Markets"
          lede="Who actually makes the constrained things, from the mine to the buyer, and how hard each one would be to replace."
          stats={[
            {
              label: 'Organisations',
              value: totals.organisations,
              note: `in ${totals.jurisdictions} countries`,
            },
            {
              label: 'Graded',
              value: totals.graded,
              note: `${totals.chokepoints} would be hard to replace at all`,
            },
            {
              label: 'Existence verified',
              value: totals.existenceVerified,
              note: `of ${totals.organisations}, from their maker rows`,
            },
            {
              label: 'Chain layers',
              value: CHAIN_LAYERS.length,
              note: 'extraction through deployment',
            },
          ]}
        />

        <div className="mb-6 rounded-lg border border-strong bg-surface-raised px-5 py-4">
          <p className="max-w-prose text-sm leading-relaxed text-fg-secondary">
            <span className="font-medium text-fg-primary">Read this first.</span> The grades in this
            directory are unsourced judgements. What is verified is narrower and shown per row:
            which organisations make a covered material, each checked against a source you can open.
            A row saying &ldquo;hard to replace&rdquo; with no verified line under it is a lead, not
            a finding.
          </p>
        </div>

        <div className="flex flex-col gap-3 border-y border-subtle py-4">
          <FilterRow label="Industry">
            {chips(
              'industry',
              INDUSTRIES.map((i) => ({ id: i.id, name: i.name })),
            )}
          </FilterRow>
          <FilterRow label="Chain">
            {chips(
              'layer',
              CHAIN_LAYERS.map((l) => ({ id: l.id, name: l.name })),
            )}
          </FilterRow>
          <FilterRow label="Grade">
            {chips('grade', [
              { id: 'chokepoint', name: 'Hard to replace' },
              { id: 'concentrated', name: 'Few alternatives' },
              { id: 'competitive', name: 'Replaceable' },
            ])}
          </FilterRow>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-strong">
                {['Organisation', 'Role', 'Where', 'Makes', 'How replaceable'].map((column, i) => (
                  <th
                    key={column}
                    scope="col"
                    className={`py-2.5 pr-4 font-mono text-xs font-medium uppercase tracking-caps text-fg-tertiary ${
                      i === 1 ? 'hidden lg:table-cell' : i === 2 ? 'hidden sm:table-cell' : ''
                    }`}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {byLayer.flatMap(([layer, rows]) => [
                <tr key={`layer-${layer.id}`} className="bg-surface-raised">
                  <th
                    scope="rowgroup"
                    colSpan={5}
                    className="py-2 pr-4 text-left font-heading text-base font-semibold text-fg-primary"
                  >
                    {layer.name}
                    <span className="ml-3 font-mono text-xs font-normal text-fg-muted">
                      {rows.length}
                    </span>
                  </th>
                </tr>,
                ...rows.map((row) => (
                  <tr key={row.slug} className="group align-top">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/markets/${row.slug}`}
                        className="font-medium text-fg-primary underline-offset-4 group-hover:underline"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="hidden max-w-xs py-3 pr-4 text-sm text-fg-secondary lg:table-cell">
                      {row.role ?? <span className="text-fg-muted">Listed as a maker only</span>}
                    </td>
                    <td className="hidden py-3 pr-4 font-mono text-xs tabular-nums text-fg-secondary sm:table-cell">
                      {row.jurisdictions.length ? row.jurisdictions.join(' ') : '—'}
                    </td>
                    <td className="py-3 pr-4 text-sm">
                      {row.produces.length > 0 ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="font-mono text-xs tabular-nums text-fg-secondary">
                            {row.produces.length}
                          </span>
                          <Status
                            state={row.existenceVerifiedBy ? 'sourced' : 'unverified'}
                            compact
                            label={row.existenceVerifiedBy ? 'verified' : 'unverified'}
                          />
                        </span>
                      ) : (
                        <span className="text-xs text-fg-muted">—</span>
                      )}
                    </td>
                    <td className="py-3">
                      <Grade grade={row.scarcity} />
                    </td>
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
        <p className="mt-3 font-mono text-xs text-fg-muted">
          {result.matched} of {result.total}
        </p>
        <Legend
          items={[
            {
              term: 'Makes',
              detail:
                'How many covered materials this organisation is mapped as making, and whether any of those rows has been verified against a source.',
            },
            { term: 'Hard to replace', detail: SCARCITY_DETAIL.chokepoint },
            { term: 'Few alternatives', detail: SCARCITY_DETAIL.concentrated },
            { term: 'Replaceable', detail: SCARCITY_DETAIL.competitive },
          ]}
        />
      </Page>
    </Shell>
  );
}

export type { ChainLayer };
