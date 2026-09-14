import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { applyQuery, parseQuery } from 'listkit';

import { COMPANY } from '@/config/substrata';
import { EVIDENCE } from '@/config/substrata-evidence';
import { RESEARCH_PROGRAMMES, programmeProgress } from '@/config/substrata-programmes';
import { BOARD_SPEC, BOTTLENECKS, portalTotals } from '@/lib/bottlenecks';
import { Board } from '@/components/portal/Board';
import { Heading, Page, Shell } from '@/components/portal/Shell';

export const metadata: Metadata = {
  title: { absolute: `${COMPANY.name} — bottlenecks on the path to recursive self-improvement` },
  description: COMPANY.tagline,
};

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The board is the front page. Numbers first, then every bottleneck as a row.
 * A reader who scrolls no further has seen the state of the research.
 */
export default async function BoardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = parseQuery(params, BOARD_SPEC);
  const result = applyQuery(BOTTLENECKS, BOARD_SPEC, query);
  const totals = portalTotals();
  const programme = RESEARCH_PROGRAMMES[0];
  const progress = programmeProgress(programme);
  const checked = EVIDENCE.generatedAt ? EVIDENCE.generatedAt.slice(0, 10) : null;

  const tiles = [
    {
      label: 'Bottlenecks tracked',
      value: totals.bottlenecks,
      note: 'Materials, machines, processes, people.',
    },
    {
      label: 'Producers mapped',
      value: totals.producers,
      note: `Across ${totals.jurisdictions} jurisdictions.`,
    },
    {
      label: 'Rows verified',
      value: totals.sourced,
      note: `${totals.candidates} with a candidate source.`,
    },
    {
      label: 'Programmes running',
      value: RESEARCH_PROGRAMMES.filter((p) => p.status === 'active').length,
      note: `${progress.done} of ${progress.total} deliverables done.`,
    },
  ];

  return (
    <Shell currentPath="">
      <Page>
        <header className="mb-8">
          <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
            Open research · {checked ? `Evidence checked ${checked}` : 'No engine run yet'}
          </p>
          <h1 className="mt-3 max-w-3xl font-heading text-3xl font-semibold leading-tight tracking-display text-fg-primary sm:text-5xl">
            The bottlenecks on the path to recursive self-improvement.
          </h1>
          <p className="mt-3 max-w-2xl text-base text-fg-secondary">
            Every constraint the loop waits on, who holds it, and whether we can prove it.
          </p>
        </header>

        <dl className="mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-subtle bg-border-subtle lg:grid-cols-4">
          {tiles.map((tile) => (
            <div key={tile.label} className="bg-surface-raised px-4 py-4 sm:px-5">
              <dt className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                {tile.label}
              </dt>
              <dd className="mt-2 font-heading text-3xl font-semibold tabular-nums text-fg-primary sm:text-4xl">
                {tile.value}
              </dd>
              <dd className="mt-1 text-xs text-fg-muted">{tile.note}</dd>
            </div>
          ))}
        </dl>

        <Heading
          index="01"
          title="The board"
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

        <div className="mt-14 grid gap-8 lg:grid-cols-2">
          <section>
            <Heading index="02" title="Running now" />
            <Link
              href="/research"
              className="block rounded-lg border border-subtle bg-surface-raised p-5 transition-colors hover:border-strong"
            >
              <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                Programme · since {programme.commissioned}
              </p>
              <p className="mt-2 font-heading text-xl font-semibold text-fg-primary">
                {programme.title}
              </p>
              <p className="mt-2 text-sm text-fg-secondary">{programme.question}</p>
              <p className="mt-3 font-mono text-xs text-fg-muted">
                {programme.layers.length} layers · {programme.questions.length} open questions ·{' '}
                {progress.done}/{progress.total} delivered
              </p>
            </Link>
          </section>
          <section>
            <Heading index="03" title="How to read a row" />
            <ul className="divide-y divide-subtle rounded-lg border border-subtle bg-surface-raised text-sm">
              <li className="flex gap-3 px-5 py-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-status-positive" />
                <span className="text-fg-secondary">
                  <span className="text-fg-primary">Sourced.</span> An analyst attached a primary
                  source. The only state that is a finding.
                </span>
              </li>
              <li className="flex gap-3 px-5 py-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-status-warning" />
                <span className="text-fg-secondary">
                  <span className="text-fg-primary">Candidate.</span> The engine found a page naming
                  the company with the material. Waiting on a person.
                </span>
              </li>
              <li className="flex gap-3 px-5 py-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-fg-muted" />
                <span className="text-fg-secondary">
                  <span className="text-fg-primary">Unverified.</span> A lead we believe and have
                  not confirmed. Not a finding.
                </span>
              </li>
            </ul>
          </section>
        </div>
      </Page>
    </Shell>
  );
}
