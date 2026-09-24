import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { STAGE_LABEL } from '@/config/substrata-stages';
import { INDUSTRY_LABEL, TECHNOLOGY_LABEL } from '@/config/substrata-taxonomy';
import { BOTTLENECKS, KIND_LABEL, bottleneckBySlug } from '@/lib/bottlenecks';
import { EVIDENCE, SEVERITY, WHEN, WHEN_LABEL } from '@/lib/labels';
import { correctionUrl } from '@/lib/site';
import { Page, Shell } from '@/components/portal/Shell';
import { Inquire } from '@/components/portal/Inquire';
import { EntityProfile, type ExtraSection } from '@/components/portal/EntityProfile';
import { KeyNumbers } from '@/components/series/KeyNumbers';
import { allSeries } from '@/lib/series-store';
import { seriesFor } from '@/lib/series';
import { claimsFor } from '@/lib/claims';
import { resolveIn } from '@/lib/entities/registry';
import { SeverityBar, Status, rowLabel } from '@/components/portal/Status';
import { FollowButton } from '@/components/portal/FollowButton';
import { currentSession } from '@/lib/auth';
import { readFollows } from '@/lib/desk-store';
import { pipelineSection } from '@/components/science/BottleneckPipeline';
import { CheckThis } from '@/components/portal/CheckThis';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return BOTTLENECKS.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const b = bottleneckBySlug(slug);
  return b ? { title: b.name, description: b.plain } : {};
}

/**
 * One bottleneck: what it is and how it is judged, then the shared modules.
 *
 * The nine sections that used to live here — why it holds things up, the
 * severity tests, who makes it, the rules, what would remove it, what was
 * predicted, who could fund relief, what has happened and which loops wait on
 * it — are modules. The fixed order this page documented is now the registry's
 * `importance` scale, and every other entity follows the same one.
 */
export default async function BottleneckPage({ params }: RouteParams) {
  const { slug } = await params;
  const b = bottleneckBySlug(slug);
  if (!b) notFound();

  const entity = resolveIn('bottleneck', b.slug);
  const session = await currentSession();
  const follows = session?.actorId ? await readFollows(session.actorId) : null;
  const science = await pipelineSection(b);
  // Dated numbers first: the corpus from git, official statistics from the
  // database when it answers. Importance 5 puts them above the judgement.
  const numbers = await allSeries();
  const series = seriesFor(numbers.series, b.slug);
  const extra: ExtraSection[] =
    series.length > 0
      ? [
          {
            id: 'key-numbers',
            title: 'Key numbers',
            importance: 5,
            node: (
              <KeyNumbers
                series={series}
                officialOk={numbers.officialOk}
                claims={claimsFor(b.slug)}
                all={numbers.series}
              />
            ),
            evidence: 'dated, each linked to its source',
          },
        ]
      : [];

  return (
    <Shell currentPath="bottlenecks">
      <Page>
        <nav className="mb-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary">
          <Link href="/bottlenecks" className="hover:text-fg-primary">
            Bottlenecks
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/bottlenecks?stage=${b.stage}`} className="hover:text-fg-primary">
            {STAGE_LABEL[b.stage]}
          </Link>
        </nav>

        <header className="mb-10 border-b border-subtle pb-8">
          <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
            {KIND_LABEL[b.kind]}
            {b.area ? ` · ${b.area}` : ''}
            {b.jurisdictions.length ? ` · ${b.jurisdictions.join(' ')}` : ''}
          </p>
          <h1 className="mt-3 max-w-3xl font-heading text-3xl font-semibold leading-tight tracking-display text-fg-primary sm:text-4xl">
            {b.name}
          </h1>
          <p className="mt-4 max-w-prose text-lg leading-relaxed text-fg-secondary">{b.plain}</p>
          {follows && (
            // Signed in: put this row on the desk, or keep it off, from where it is read.
            <div className="mt-5 flex flex-wrap gap-3">
              <FollowButton
                type="bottleneck"
                id={b.slug}
                following={follows.bottlenecks.includes(b.slug)}
                label="on my desk"
              />
              <FollowButton
                type="mute"
                id={b.slug}
                following={follows.muted.includes(b.slug)}
                label="on my desk"
              />
            </div>
          )}

          <dl
            id="assessment"
            className="mt-6 grid gap-px overflow-hidden rounded-lg border border-subtle bg-border-subtle sm:grid-cols-3"
          >
            <div className="bg-surface-raised px-4 py-3">
              <dt className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                {SEVERITY.label}
              </dt>
              <dd className="mt-1.5">
                <SeverityBar value={b.binding} />
              </dd>
              <dd className="mt-1 text-xs text-fg-muted">{SEVERITY.short}</dd>
            </div>
            <div className="bg-surface-raised px-4 py-3">
              <dt className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                {WHEN.label}
              </dt>
              <dd className="mt-1.5 text-sm text-fg-primary">{WHEN_LABEL[b.horizon]}</dd>
              <dd className="mt-1 text-xs text-fg-muted">judged {b.judgedOn}</dd>
            </div>
            <div className="bg-surface-raised px-4 py-3">
              <dt className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                {EVIDENCE.label}
              </dt>
              <dd className="mt-1.5">
                <Status state={b.state} label={rowLabel(b.counts)} />
              </dd>
              <dd className="mt-1 text-xs text-fg-muted">
                {b.counts.total > 0 ? `${b.counts.total} maker rows` : 'single node, no maker list'}
              </dd>
            </div>
          </dl>
          <p className="mt-2">
            <CheckThis
              label="Check these facts with Ask"
              claim={`${b.name}: ${b.plain} Assessed ${SEVERITY.label.toLowerCase()} ${b.binding}; ${WHEN.label.toLowerCase()} ${WHEN_LABEL[b.horizon]} (judged ${b.judgedOn}); evidence: ${rowLabel(b.counts) ?? b.state}.`}
            />
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {b.technologies.map((t) => (
              <Link
                key={t}
                href={`/bottlenecks?tech=${t}`}
                className="text-fg-tertiary underline-offset-4 hover:text-fg-primary hover:underline"
              >
                {TECHNOLOGY_LABEL[t]}
              </Link>
            ))}
            {b.industries.map((i) => (
              <Link
                key={i}
                href={`/bottlenecks?industry=${i}`}
                className="text-fg-tertiary underline-offset-4 hover:text-fg-primary hover:underline"
              >
                {INDUSTRY_LABEL[i]}
              </Link>
            ))}
            <a
              href={correctionUrl(b.name)}
              className="text-accent underline-offset-4 hover:underline"
            >
              Report an error on GitHub
            </a>
          </div>
          <div className="mt-4">
            <Inquire topic={b.name} />
          </div>
        </header>

        {entity && (
          <EntityProfile entity={entity} extra={[...extra, ...(science ? [science] : [])]} />
        )}
      </Page>
    </Shell>
  );
}
