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
import { correctionUrl } from '@/lib/site';
import { Page, Shell } from '@/components/portal/Shell';
import { EntityProfile } from '@/components/portal/EntityProfile';
import { resolveIn } from '@/lib/entities/registry';

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

/**
 * One science entry: its identity, then the shared profile modules.
 *
 * What it would relieve, how far off it is and what to watch for are modules,
 * so they are ordered and numbered by the registry and read in the same shape
 * as every other profile on the site.
 */
export default async function SciencePage({ params }: RouteParams) {
  const { slug } = await params;
  const entry = SCIENCE.find((s) => s.id === slug);
  if (!entry) notFound();

  const band = readinessBand(entry.readiness);
  const entity = resolveIn('science', entry.id);

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

        {entity && <EntityProfile entity={entity} />}

        <p className="mt-12 text-sm">
          <Link href="/science" className="text-accent underline-offset-4 hover:underline">
            ← All technologies
          </Link>
        </p>
      </Page>
    </Shell>
  );
}
