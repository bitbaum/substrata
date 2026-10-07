import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { applyQuery, parseQuery } from 'listkit';

import { STAGES } from '@/config/substrata-stages';
import { BOARD_SPEC, BOTTLENECKS, portalTotals, tightestNow } from '@/lib/bottlenecks';
import { Board } from '@/components/portal/Board';
import { Figure } from '@/components/portal/Figure';
import { Page, SectionHeader, Shell } from '@/components/portal/Shell';
import { TightestNow } from '@/components/portal/TightestNow';

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
  // The opening is for the whole board; once a reader narrows it, the table is the answer.
  const narrowed = Boolean(query.q) || Object.values(query.facets).some((v) => v.length > 0);

  return (
    <Shell>
      <Page>
        <SectionHeader
          title="Bottlenecks"
          lede="The machines, materials, power, permits and people that decide how fast AI, energy and robots can grow — each in one plain sentence, with how hard it binds, who makes it and how well that is sourced. Start with the tightest, or jump to a stage."
          stats={[
            {
              label: 'Mapped',
              value: <Figure method="bottleneck-count">{totals.bottlenecks}</Figure>,
              note: (
                <>
                  across{' '}
                  <Figure method="stage-counts">
                    {covered} of {STAGES.length}
                  </Figure>{' '}
                  stages
                </>
              ),
            },
            {
              label: 'Binding now',
              value: <Figure method="binding-now">{totals.bindingNow}</Figure>,
              note: 'judged to be the constraint today',
            },
            {
              label: 'Maker rows sourced',
              value: (
                <Figure method="sourced-rows">
                  {totals.sourced}/{totals.producers}
                </Figure>
              ),
              note: (
                <>
                  <Figure method="sourced-rows">{totals.producers - totals.sourced}</Figure> still
                  unverified
                </>
              ),
            },
            {
              label: 'Countries',
              value: <Figure method="jurisdictions">{totals.jurisdictions}</Figure>,
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
        {!narrowed && <TightestNow rows={tightestNow(BOTTLENECKS)} />}
        <Board params={params} query={query} result={result} />
      </Page>
    </Shell>
  );
}
