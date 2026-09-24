import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

import { NOT_SEARCHED_WHY, SCIENCE_QUERIES } from '@/config/substrata-pipeline';
import { Empty, Heading, Page, SectionHeader, Shell } from '@/components/portal/Shell';
import { Figure } from '@/components/portal/Figure';
import { StageBar, StageLegend } from '@/components/science/StageBar';
import { ItemList } from '@/components/science/ItemList';
import { BOTTLENECKS } from '@/lib/bottlenecks';
import { funnelFor } from '@/lib/science-pipeline';
import {
  funnelCounts,
  lastScienceRun,
  newItems,
  type FunnelRow,
  type RunInfo,
  type StoredItem,
} from '@/lib/science-read';
import { pipelineHref, pipelineOrgHref } from '@/lib/links';
import { whenLabel } from '@/lib/desk';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Science pipeline',
  description:
    'For every bottleneck: the research, lab work, pilots and products that could relieve it — who is doing it, how far along, and what is new this week.',
};

export default async function PipelinePage() {
  let counts: FunnelRow[] | null = null;
  let fresh: StoredItem[] = [];
  let run: RunInfo | null = null;
  try {
    [counts, fresh, run] = await Promise.all([
      funnelCounts(),
      newItems(null, 25),
      lastScienceRun(),
    ]);
  } catch {
    counts = null;
  }
  const total = (counts ?? []).reduce((n, c) => n + c.items, 0);
  const newCount = (counts ?? []).reduce((n, c) => n + c.fresh, 0);
  const now = new Date();

  return (
    <Shell currentPath="science">
      <Page>
        <nav className="mb-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary">
          <Link href="/science" className="hover:text-fg-primary">
            Science
          </Link>
          <span className="mx-2">/</span>
          Pipeline
        </nav>
        <SectionHeader
          title="Science pipeline"
          lede="From fundamental research to production at scale, for every bottleneck: what is being worked on, by whom, and how far along it is. Papers, preprints and grants arrive from open databases every day; the hand-written judgements sit beside them, never added to them."
          stats={[
            {
              label: 'Items collected',
              value: <Figure method="science-pipeline">{total}</Figure>,
              note: 'papers, preprints and grants — unreviewed',
            },
            {
              label: 'New this week',
              value: <Figure method="science-new">{newCount}</Figure>,
              note: 'found this week, published this month',
            },
            {
              label: 'Bottlenecks searched',
              value: (
                <Figure method="science-pipeline">{`${run?.bottlenecks ?? 0}/${Object.keys(SCIENCE_QUERIES).length}`}</Figure>
              ),
              note: 'each searched about once a day',
            },
            {
              label: 'Last fetch',
              value: run ? whenLabel(run.finishedAt, now) : '—',
              note: 'OpenAlex, arXiv, NSF, OpenAIRE, USAspending',
            },
          ]}
          action={
            <Link
              href={pipelineOrgHref()}
              className="text-accent underline-offset-4 hover:underline"
            >
              Who is doing it →
            </Link>
          }
        />

        <section className="mb-12">
          <Heading index="01" title="Stage by bottleneck" />
          <StageLegend />
          {counts === null ? (
            <Empty
              what="The science feed could not be read just now."
              next="Judgements still show on each bottleneck's page."
            />
          ) : (
            <ul className="pipe-rows">
              {BOTTLENECKS.map((b) => (
                <li key={b.slug} className="pipe-row">
                  <Link href={pipelineHref(b.slug)} className="pipe-row-name">
                    {b.name}
                  </Link>
                  {b.name in SCIENCE_QUERIES ? (
                    <StageBar bottleneck={b.slug} cells={funnelFor(b.name, counts ?? [])} />
                  ) : (
                    <p className="pipe-row-note">
                      {NOT_SEARCHED_WHY[b.name] ?? 'Not searched yet.'}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <Heading index="02" title="New this week" aside="Newest first, every bottleneck" />
          {fresh.length > 0 ? (
            <ItemList items={fresh} showBottleneck />
          ) : (
            <Empty what="Nothing new has been collected this week yet." />
          )}
        </section>
      </Page>
    </Shell>
  );
}
