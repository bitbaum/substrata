import React from 'react';
import Link from 'next/link';
import { Figure } from '@/components/portal/Figure';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
  INSTRUMENT_EFFECT_LABEL,
  INSTRUMENT_KIND_LABEL,
  INSTRUMENT_STATUS_LABEL,
  JURISDICTIONS,
  JURISDICTION_LABEL,
  POLICY_PAGES,
  instrumentsIn,
  recommendationsIn,
  type JurisdictionId,
} from '@/config/substrata-policy';
import { Empty, Heading, Page, Shell } from '@/components/portal/Shell';
import { bottleneckHref } from '@/lib/links';

interface RouteParams {
  params: Promise<{ jurisdiction: string }>;
}

export function generateStaticParams(): Array<{ jurisdiction: string }> {
  return [...POLICY_PAGES].map((jurisdiction) => ({ jurisdiction }));
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { jurisdiction } = await params;
  const j = JURISDICTIONS.find((x) => x.id === jurisdiction);
  return j ? { title: `${j.name} policy`, description: j.detail } : {};
}

export default async function JurisdictionPage({ params }: RouteParams) {
  const { jurisdiction } = await params;
  const j = JURISDICTIONS.find((x) => x.id === jurisdiction);
  if (!j) notFound();

  const instruments = instrumentsIn(j.id as JurisdictionId);
  const recommendations = recommendationsIn(j.id as JurisdictionId);
  const slowing = instruments.filter((i) => i.effect === 'tightens').length;
  const speeding = instruments.filter((i) => i.effect === 'loosens').length;
  const mixed = instruments.length - slowing - speeding;

  return (
    <Shell>
      <Page>
        <nav
          aria-label="Breadcrumb"
          className="crumbs mb-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary"
        >
          <Link href="/policy" className="hover:text-fg-primary">
            Policy
          </Link>
          <span className="mx-2">/</span>
          {j.name}
        </nav>

        <header className="mb-8 border-b border-subtle pb-8">
          <h1 className="font-heading text-3xl font-semibold tracking-display text-fg-primary sm:text-4xl">
            {j.name}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-fg-secondary">{j.detail}</p>
          <p className="mt-3 font-mono text-xs text-fg-muted">
            {instruments.length} rule{instruments.length === 1 ? '' : 's'} tracked ·{' '}
            <Figure method="rule-direction">{slowing}</Figure> slow building ·{' '}
            <Figure method="rule-direction">{speeding}</Figure> speed it
            {mixed > 0 && (
              <>
                {' '}
                · <Figure method="rule-direction">{mixed}</Figure> both ways
              </>
            )}
          </p>
        </header>

        <section className="mb-12">
          <Heading index="01" title="Rules tracked here" />
          {instruments.length === 0 ? (
            <Empty what="Nothing researched for this jurisdiction yet." />
          ) : (
            <ul className="divide-y divide-subtle border-y border-subtle">
              {instruments.map((instrument) => (
                <li key={instrument.id} className="py-4">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-mono text-xs tabular-nums text-fg-tertiary">
                      {instrument.date}
                    </span>
                    <span className="font-mono text-xs uppercase tracking-caps text-fg-muted">
                      {INSTRUMENT_KIND_LABEL[instrument.kind]}
                    </span>
                    <span className="text-sm text-fg-secondary">
                      {INSTRUMENT_EFFECT_LABEL[instrument.effect]}
                    </span>
                    <span className="font-mono text-xs text-fg-muted">
                      {INSTRUMENT_STATUS_LABEL[instrument.status]}
                    </span>
                  </div>
                  <p className="mt-1 font-medium text-fg-primary">{instrument.title}</p>
                  <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-secondary">
                    {instrument.summary}
                  </p>
                  {instrument.bottlenecks.length > 0 && (
                    <p className="mt-1 flex flex-wrap gap-x-3 text-xs">
                      {instrument.bottlenecks.map((name) => (
                        <Link
                          key={name}
                          href={bottleneckHref(name)}
                          className="text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
                        >
                          {name}
                        </Link>
                      ))}
                    </p>
                  )}
                  <p className="mt-1 text-xs">
                    <a
                      href={instrument.source}
                      rel="noreferrer"
                      className="text-accent underline-offset-4 hover:underline"
                    >
                      {instrument.body} ↗
                    </a>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {recommendations.length > 0 && (
          <section>
            <Heading index="02" title="What we would change here" aside="This project's own view" />
            <ul className="divide-y divide-subtle border-y border-subtle">
              {recommendations.map((rec) => (
                <li key={rec.id} className="py-4">
                  <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                    Decided by {rec.decider}
                  </p>
                  <p className="mt-1 max-w-prose font-medium text-fg-primary">{rec.change}</p>
                  <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-secondary">
                    {rec.because}
                  </p>
                  <p className="mt-2 max-w-prose text-xs leading-relaxed text-fg-tertiary">
                    <span className="font-mono uppercase tracking-caps">Wrong if · </span>
                    {rec.falsifier}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-10 text-sm">
          <Link href="/policy" className="text-accent underline-offset-4 hover:underline">
            ← All jurisdictions
          </Link>
        </p>
      </Page>
    </Shell>
  );
}

export { JURISDICTION_LABEL };
