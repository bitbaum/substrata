import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
  READINESS_BAND_LABEL,
  SCIENCE,
  readinessBand,
  readinessLabel,
} from '@/config/substrata-science';
import { INDUSTRY_LABEL, TECHNOLOGY_LABEL } from '@/config/substrata-taxonomy';
import { bottleneckByName, slugOf } from '@/lib/bottlenecks';
import { bottleneckHref } from '@/lib/links';
import { correctionUrl } from '@/lib/site';
import { Heading, Page, Shell } from '@/components/portal/Shell';
import { SeverityBar } from '@/components/portal/Status';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return SCIENCE.map((entry) => ({ slug: entry.id }));
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const entry = SCIENCE.find((s) => s.id === slug);
  return entry ? { title: entry.name, description: entry.plain } : {};
}

export default async function SciencePage({ params }: RouteParams) {
  const { slug } = await params;
  const entry = SCIENCE.find((s) => s.id === slug);
  if (!entry) notFound();

  const band = readinessBand(entry.readiness);

  return (
    <Shell currentPath="science">
      <Page>
        <nav className="mb-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary">
          <Link href="/science" className="hover:text-fg-primary">
            Science
          </Link>
          <span className="mx-2">/</span>
          {TECHNOLOGY_LABEL[entry.front]}
        </nav>

        <header className="mb-8 border-b border-subtle pb-8">
          <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
            {TECHNOLOGY_LABEL[entry.front]}
            {entry.industries.length > 0 &&
              ` · ${entry.industries.map((i) => INDUSTRY_LABEL[i]).join(' · ')}`}
          </p>
          <h1 className="mt-3 max-w-3xl font-heading text-3xl font-semibold leading-tight tracking-display text-fg-primary sm:text-4xl">
            {entry.name}
          </h1>
          <p className="mt-4 max-w-prose text-base leading-relaxed text-fg-secondary">
            {entry.plain}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="text-fg-secondary">
              <span className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                Readiness ·{' '}
              </span>
              {entry.readiness}/9 — {readinessLabel(entry.readiness)} ({READINESS_BAND_LABEL[band]})
            </span>
            <a
              href={correctionUrl(entry.name)}
              className="text-accent underline-offset-4 hover:underline"
            >
              Report an error on GitHub
            </a>
          </div>
        </header>

        <section className="mb-12">
          <Heading index="01" title="What it would relieve" />
          <ul className="divide-y divide-subtle border-y border-subtle">
            {entry.relieves.map((relief) => {
              const bottleneck = bottleneckByName(relief.bottleneck);
              return (
                <li key={relief.bottleneck} className="py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                    <Link
                      href={bottleneckHref(relief.bottleneck)}
                      className="font-medium text-fg-primary underline-offset-4 hover:underline"
                    >
                      {relief.bottleneck}
                    </Link>
                    {bottleneck && <SeverityBar value={bottleneck.binding} />}
                  </div>
                  <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-secondary">
                    {relief.mechanism}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mb-12">
          <Heading index="02" title="How far off it is" aside={`judged ${entry.judgedOn}`} />
          <div className="rounded-lg border border-subtle bg-surface-raised px-5 py-4">
            <p className="font-heading text-2xl font-semibold text-fg-primary">
              {entry.readiness}
              <span className="text-base font-normal text-fg-muted"> / 9</span>
              <span className="ml-3 font-sans text-base font-normal text-fg-secondary">
                {readinessLabel(entry.readiness)}
              </span>
            </p>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-fg-secondary">
              {entry.readinessWhy}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-fg-tertiary">
              {entry.source ? (
                <a
                  href={entry.source}
                  rel="noreferrer"
                  className="text-accent underline-offset-4 hover:underline"
                >
                  Source ↗
                </a>
              ) : (
                'Unsourced: this is a judgement, and no citation has been attached to it yet.'
              )}
            </p>
          </div>
        </section>

        {entry.nextMilestone && (
          <section>
            <Heading index="03" title="What to watch for" />
            <p className="max-w-prose border-y border-subtle py-4 text-base leading-relaxed text-fg-secondary">
              {entry.nextMilestone}
            </p>
          </section>
        )}

        <p className="mt-10 text-sm">
          <Link href="/science" className="text-accent underline-offset-4 hover:underline">
            ← All technologies
          </Link>
        </p>
      </Page>
    </Shell>
  );
}
