import React from 'react';
import Link from 'next/link';
import { Figure } from '@/components/portal/Figure';
import { JUDGED_BY } from '@/config/substrata-about';
import { LOOP_PERIOD_ESTIMATE } from '@/config/substrata-programmes';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { loops } from '@/lib/kpi/loops';
import { correctionUrl } from '@/lib/site';
import { Page, Shell } from '@/components/portal/Shell';
import { EntityProfile } from '@/components/portal/EntityProfile';
import { resolveIn } from '@/lib/entities/registry';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return loops().map((loop) => ({ slug: loop.id }));
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const loop = loops().find((l) => l.id === slug);
  return loop
    ? { title: `${loop.name} loop`, description: `One turn takes ${loop.period}. ${loop.turn}` }
    : {};
}

/**
 * One loop — the object the whole site is upstream of.
 *
 * A loop is design, build, measure, and the site's claim is that technology
 * improves at the speed of the slowest one. Until now they were the only thing
 * in the model with no page: not linkable, not searchable, not discussable.
 */
export default async function LoopPage({ params }: RouteParams) {
  const { slug } = await params;
  const loop = loops().find((l) => l.id === slug);
  if (!loop) notFound();

  const entity = resolveIn('loop', loop.id);

  return (
    <Shell>
      <Page>
        <nav
          aria-label="Breadcrumb"
          className="crumbs mb-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary"
        >
          <Link href="/research" className="hover:text-fg-primary">
            Research
          </Link>
          <span className="mx-2">/</span>
          Loops
        </nav>

        <header className="mb-8 border-b border-subtle pb-8">
          <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
            Loop · one turn takes{' '}
            <Figure estimate={{ by: JUDGED_BY, ...LOOP_PERIOD_ESTIMATE }}>
              {loop.period.toLowerCase()}
            </Figure>
          </p>
          <h1 className="mt-3 max-w-3xl font-heading text-3xl font-semibold leading-tight tracking-display text-fg-primary sm:text-4xl">
            {loop.name}
          </h1>
          <p className="mt-4 max-w-prose text-lg leading-relaxed text-fg-secondary">
            {loop.gates.length > 0 ? (
              <>
                <Figure method="binding-now">
                  {loop.bindingNow} of {loop.gates.length}
                </Figure>{' '}
                recorded gates are judged to bite today.
              </>
            ) : (
              'Nothing in the corpus is recorded as gating this loop yet.'
            )}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="text-fg-muted">
              This is the project&rsquo;s own model, not a measurement
            </span>
            <a
              href={correctionUrl(loop.name)}
              className="text-accent underline-offset-4 hover:underline"
            >
              Report an error on GitHub
            </a>
          </div>
        </header>

        {entity && <EntityProfile entity={entity} />}

        <p className="mt-12 text-sm">
          <Link href="/research" className="text-accent underline-offset-4 hover:underline">
            ← The programme
          </Link>
        </p>
      </Page>
    </Shell>
  );
}
