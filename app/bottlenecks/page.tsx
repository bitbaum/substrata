import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { applyQuery, parseQuery } from 'listkit';

import { STAGES } from '@/config/substrata-stages';
import { BOARD_SPEC, BOTTLENECKS, portalTotals } from '@/lib/bottlenecks';
import { LOOP_IN_ONE_LINE } from '@/lib/labels';
import { Board } from '@/components/portal/Board';
import { Page, SectionHeader, Shell } from '@/components/portal/Shell';

export const metadata: Metadata = {
  title: 'Bottlenecks',
  description:
    'The constraints on building compute, energy, materials and robots: what each one is, how hard it binds, and when.',
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function BottlenecksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = parseQuery(params, BOARD_SPEC);
  const result = applyQuery(BOTTLENECKS, BOARD_SPEC, query);
  const totals = portalTotals();
  const covered = new Set(BOTTLENECKS.map((b) => b.stage)).size;

  return (
    <Shell currentPath="bottlenecks">
      <Page>
        <SectionHeader
          title="Bottlenecks"
          lede="Everything that has to exist before more compute, more power or more machines can be built — and how hard each one is holding things up."
          stats={[
            {
              label: 'Mapped',
              value: totals.bottlenecks,
              note: `across ${covered} of ${STAGES.length} stages`,
            },
            {
              label: 'Binding now',
              value: totals.bindingNow,
              note: 'judged to be the constraint today',
            },
            {
              label: 'Makers verified',
              value: `${totals.sourced}/${totals.producers}`,
              note: `${totals.candidates} have a source found but unchecked`,
            },
            {
              label: 'Countries',
              value: totals.jurisdictions,
              note: 'where the mapped makers operate',
            },
          ]}
          action={
            <Link
              href="/api/map"
              className="text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
            >
              As JSON →
            </Link>
          }
        />
        <p className="mb-6 max-w-prose text-sm leading-relaxed text-fg-tertiary">
          Rows are grouped by which part of the process they hold up. {LOOP_IN_ONE_LINE}
        </p>
        <Board params={params} query={query} result={result} />
      </Page>
    </Shell>
  );
}
