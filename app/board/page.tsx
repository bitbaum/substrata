import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { applyQuery, parseQuery } from 'listkit';

import { BOARD_SPEC, BOTTLENECKS, portalTotals } from '@/lib/bottlenecks';
import { Board } from '@/components/portal/Board';
import { Heading, Page, Shell } from '@/components/portal/Shell';

export const metadata: Metadata = {
  title: 'Board',
  description:
    'Every bottleneck on the path to transformative technology, by stage, scored and dated.',
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function BoardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = parseQuery(params, BOARD_SPEC);
  const result = applyQuery(BOTTLENECKS, BOARD_SPEC, query);
  const totals = portalTotals();

  return (
    <Shell currentPath="board">
      <Page>
        <header className="mb-6">
          <h1 className="font-heading text-3xl font-semibold tracking-display text-fg-primary sm:text-4xl">
            The board
          </h1>
          <p className="mt-2 max-w-2xl text-base text-fg-secondary">
            {totals.bottlenecks} bottlenecks across {new Set(BOTTLENECKS.map((b) => b.stage)).size}{' '}
            stages of the loop, {totals.bindingNow} of them binding now.
          </p>
        </header>
        <Heading
          index="01"
          title="Every bottleneck"
          aside={
            <Link
              href="/api/map"
              className="underline-offset-4 hover:text-fg-primary hover:underline"
            >
              As JSON →
            </Link>
          }
        />
        <Board params={params} query={query} result={result} />
      </Page>
    </Shell>
  );
}
