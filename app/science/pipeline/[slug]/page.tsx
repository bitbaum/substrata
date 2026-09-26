import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
  NOT_SEARCHED_WHY,
  PIPELINE_STAGES,
  SCIENCE_QUERIES,
  type PipelineStage,
} from '@/config/substrata-pipeline';
import { Empty, Heading, Page, Shell } from '@/components/portal/Shell';
import { StageBar, StageLegend } from '@/components/science/StageBar';
import { ItemList } from '@/components/science/ItemList';
import { JudgementList } from '@/components/science/JudgementList';
import { CompaniesActive } from '@/components/science/CompaniesActive';
import { bottleneckBySlug } from '@/lib/bottlenecks';
import { funnelFor } from '@/lib/science-pipeline';
import {
  funnelCounts,
  itemsFor,
  orgActivity,
  type FunnelRow,
  type OrgActivity,
  type StoredItem,
} from '@/lib/science-read';
import { bottleneckHref, pipelineHref } from '@/lib/links';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ stage?: string; sort?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = bottleneckBySlug((await params).slug);
  return b
    ? {
        title: `${b.name} — science pipeline`,
        description: `Research, lab work, pilots and products that could relieve ${b.name}.`,
      }
    : {};
}

export default async function BottleneckPipelinePage({ params, searchParams }: Props) {
  const b = bottleneckBySlug((await params).slug);
  if (!b) notFound();
  const query = await searchParams;
  const stage = PIPELINE_STAGES.find((s) => s.id === query.stage)?.id ?? null;
  const order = query.sort === 'cited' ? 'cited' : 'recent';

  let counts: FunnelRow[] | null = null;
  let items: StoredItem[] = [];
  let orgs: OrgActivity[] = [];
  try {
    [counts, items, orgs] = await Promise.all([
      funnelCounts(),
      itemsFor(b.name, stage, 80, order),
      orgActivity(b.name),
    ]);
  } catch {
    counts = null;
  }
  const cells = funnelFor(b.name, counts ?? []);
  const judgements = cells
    .filter((c) => stage === null || c.stage === stage)
    .flatMap((c) => c.judgements);
  const stageInfo = PIPELINE_STAGES.find((s) => s.id === stage);
  const q = SCIENCE_QUERIES[b.name];
  const href = (next: { stage?: PipelineStage | null; order?: 'recent' | 'cited' }) => {
    const params = new URLSearchParams();
    const s = next.stage === undefined ? stage : next.stage;
    if (s) params.set('stage', s);
    if ((next.order ?? order) === 'cited') params.set('sort', 'cited');
    const qs = params.toString();
    return `${pipelineHref(b.slug)}${qs ? `?${qs}` : ''}`;
  };

  return (
    <Shell>
      <Page>
        <nav className="mb-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary">
          <Link href="/science" className="hover:text-fg-primary">
            Science
          </Link>
          <span className="mx-2">/</span>
          <Link href={pipelineHref()} className="hover:text-fg-primary">
            Pipeline
          </Link>
        </nav>
        <header className="mb-8 border-b border-subtle pb-8">
          <h1 className="font-heading text-3xl font-semibold tracking-display text-fg-primary sm:text-4xl">
            {b.name}
          </h1>
          <p className="mt-3 max-w-prose text-base leading-relaxed text-fg-secondary">{b.plain}</p>
          <p className="mt-3 text-sm">
            <Link
              href={bottleneckHref(b.slug)}
              className="text-accent underline-offset-4 hover:underline"
            >
              The bottleneck itself →
            </Link>
          </p>
          <div className="mt-6">
            {q ? (
              <StageBar bottleneck={b.slug} cells={cells} />
            ) : (
              <p className="pipe-row-note">{NOT_SEARCHED_WHY[b.name] ?? 'Not searched yet.'}</p>
            )}
            <StageLegend />
          </div>
          {q && (
            <p className="mt-3 max-w-prose text-xs leading-relaxed text-fg-muted">
              Searched for {q.phrases.map((p) => `“${p}”`).join(', ')} in titles and abstracts.
            </p>
          )}
          <p className="pipe-jump">
            <a href="#collected">
              {items.length > 0
                ? `${items.length} collected items, newest first ↓`
                : 'Collected items ↓'}
            </a>
            {judgements.length > 0 && <a href="#judged">Judged by hand ↓</a>}
            {orgs.length > 0 && <a href="#active">Who is active ↓</a>}
          </p>
        </header>

        <p className="pipe-filter">
          <Link href={href({ stage: null })} className={stage === null ? 'is-on' : ''}>
            All stages
          </Link>
          {PIPELINE_STAGES.map((s) => (
            <Link key={s.id} href={href({ stage: s.id })} className={stage === s.id ? 'is-on' : ''}>
              {s.label}
            </Link>
          ))}
          <span className="pipe-filter-sep" />
          <Link href={href({ order: 'recent' })} className={order === 'recent' ? 'is-on' : ''}>
            Newest
          </Link>
          <Link href={href({ order: 'cited' })} className={order === 'cited' ? 'is-on' : ''}>
            Most cited
          </Link>
        </p>
        {stageInfo && (
          <p className="mb-6 max-w-prose text-sm text-fg-secondary">
            <span className="font-medium text-fg-primary">{stageInfo.label}</span> — readiness{' '}
            {stageInfo.trl.join(' to ')} of the nine-point scale. Evidence it takes:{' '}
            {stageInfo.evidence}
          </p>
        )}

        <div id="active">
          <CompaniesActive orgs={orgs} />
        </div>

        {judgements.length > 0 && (
          <section className="mb-12" id="judged">
            <Heading
              title="Judged by hand"
              aside="Readiness and substitute status, with reasoning"
            />
            <JudgementList judgements={judgements} />
          </section>
        )}

        <section id="collected">
          <Heading
            title="Collected by the feeds"
            aside={order === 'cited' ? 'Most cited first' : 'Newest first'}
          />
          {counts === null ? (
            <Empty
              what="The science feed could not be read just now."
              action={<Link href={bottleneckHref(b.slug)}>Read the bottleneck itself</Link>}
            />
          ) : items.length > 0 ? (
            <ItemList items={items} />
          ) : (
            <Empty
              what={
                stage === 'early' || stage === 'scale'
                  ? 'The feeds never place a paper or grant here: neither shows a product is on sale.'
                  : 'Nothing collected at this stage yet.'
              }
              action={
                <>
                  {stage && <Link href={href({ stage: null })}>Every stage</Link>}
                  <Link href={pipelineHref()}>Other bottlenecks</Link>
                </>
              }
            />
          )}
        </section>
      </Page>
    </Shell>
  );
}
