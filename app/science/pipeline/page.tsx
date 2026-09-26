import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

import { NOT_SEARCHED_WHY, SCIENCE_QUERIES } from '@/config/substrata-pipeline';
import { Empty, Heading, Page, Shell } from '@/components/portal/Shell';
import { PageHeader } from '@/components/portal/PageHeader';
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
    <Shell>
      <Page>
        <PageHeader
          kicker={
            <>
              <Link href="/science">Science</Link> / Pipeline
            </>
          }
          title="Science pipeline"
          status={
            <>
              <Figure method="science-pipeline">{total}</Figure> papers, preprints and grants
              collected (unreviewed) · <Figure method="science-new">{newCount}</Figure> new this
              week ·{' '}
              <Figure method="science-pipeline">{`${run?.bottlenecks ?? 0}/${Object.keys(SCIENCE_QUERIES).length}`}</Figure>{' '}
              bottlenecks searched · last fetch {run ? whenLabel(run.finishedAt, now) : 'not yet'}
            </>
          }
          note="From fundamental research to production at scale, for every bottleneck: what is being worked on, by whom, and how far along. Items arrive daily from OpenAlex, arXiv, NSF, OpenAIRE and USAspending; the hand-written judgements sit beside them, never added to them. Pick a bottleneck to see its items."
          actions={
            <>
              <a href="#new">New this week ↓</a>
              <Link href={pipelineOrgHref()}>Who is doing it →</Link>
            </>
          }
        />

        <section className="mb-12">
          <Heading index="01" title="Stage by bottleneck" />
          <StageLegend />
          {counts === null ? (
            <Empty
              what="The science feed could not be read just now."
              next="Judgements still show on each bottleneck's page."
              action={<Link href="/bottlenecks">Every bottleneck</Link>}
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

        <section id="new">
          <Heading index="02" title="New this week" aside="Newest first, every bottleneck" />
          {fresh.length > 0 ? (
            <ItemList items={fresh} showBottleneck />
          ) : (
            <Empty
              what="Nothing new has been collected this week yet."
              action={<Link href={pipelineOrgHref()}>See who is active</Link>}
            />
          )}
        </section>
      </Page>
    </Shell>
  );
}
