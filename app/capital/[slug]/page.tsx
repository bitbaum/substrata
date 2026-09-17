import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
  CAPITAL_PROVIDERS,
  kindById,
  providerById,
  fundingFor,
  CONSTRAINT_LABEL,
} from '@/config/substrata-capital';
import { JURISDICTION_LABEL, hasPolicyPage } from '@/config/substrata-policy';
import { bottleneckHref, policyHref } from '@/lib/links';
import { correctionUrl } from '@/lib/site';
import { Heading, Page, Shell } from '@/components/portal/Shell';
import { EntityProfile } from '@/components/portal/EntityProfile';
import { resolveIn } from '@/lib/entities/registry';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return CAPITAL_PROVIDERS.map((p) => ({ slug: p.id }));
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const provider = providerById(slug);
  return provider ? { title: provider.name, description: provider.mandate } : {};
}

export default async function ProviderPage({ params }: RouteParams) {
  const { slug } = await params;
  const provider = providerById(slug);
  if (!provider) notFound();

  const kind = kindById(provider.kind);

  // Shared profile modules (discussion, connections) come from the registry,
  // so every entity gains them at once rather than page by page.
  const entity = resolveIn('capital', provider.id);

  return (
    <Shell currentPath="capital">
      <Page>
        <nav className="mb-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary">
          <Link href="/capital" className="hover:text-fg-primary">
            Capital
          </Link>
          <span className="mx-2">/</span>
          {kind.name}
        </nav>

        <header className="mb-8 border-b border-subtle pb-8">
          <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
            {kind.name} ·{' '}
            {hasPolicyPage(provider.jurisdiction) ? (
              <Link href={policyHref(provider.jurisdiction)} className="hover:text-fg-primary">
                {JURISDICTION_LABEL[provider.jurisdiction]}
              </Link>
            ) : (
              JURISDICTION_LABEL[provider.jurisdiction]
            )}
          </p>
          <h1 className="mt-3 max-w-3xl font-heading text-3xl font-semibold leading-tight tracking-display text-fg-primary sm:text-4xl">
            {provider.name}
          </h1>
          <p className="mt-4 max-w-prose text-base leading-relaxed text-fg-secondary">
            {provider.mandate}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <a
              href={provider.source}
              rel="noreferrer"
              className="text-accent underline-offset-4 hover:underline"
            >
              Its own mandate page ↗
            </a>
            <span className="text-fg-muted">
              {provider.primary ? 'official source' : 'secondary source'} · read {provider.readOn}
            </span>
            <a
              href={correctionUrl(provider.name)}
              className="text-accent underline-offset-4 hover:underline"
            >
              Report an error on GitHub
            </a>
          </div>
        </header>

        <section className="mb-12">
          <Heading index="01" title="What this kind of money does" />
          <dl className="grid gap-px overflow-hidden rounded-lg border border-subtle bg-border-subtle sm:grid-cols-2">
            {[
              ['Typical cheque', kind.chequeSize],
              ['Patience', kind.horizon],
              ['Will fund', kind.willFund],
              ['Will not fund', kind.willNotFund],
            ].map(([label, value]) => (
              <div key={label} className="bg-surface-raised px-4 py-3">
                <dt className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                  {label}
                </dt>
                <dd className="mt-1 max-w-prose text-sm leading-relaxed text-fg-secondary">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mb-12">
          <Heading
            index="02"
            title="What it could move"
            aside={`${provider.canMove.length} bottlenecks`}
          />
          <ul className="divide-y divide-subtle border-y border-subtle">
            {provider.canMove.map((name) => {
              const funding = fundingFor(name);
              return (
                <li key={name} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                    <Link
                      href={bottleneckHref(name)}
                      className="text-fg-primary underline-offset-4 hover:underline"
                    >
                      {name}
                    </Link>
                    {funding && (
                      <span className="text-sm text-fg-secondary">
                        {CONSTRAINT_LABEL[funding.constraint]}
                      </span>
                    )}
                  </div>
                  {funding && (
                    <p className="mt-1 max-w-prose text-xs leading-relaxed text-fg-tertiary">
                      {funding.why}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 max-w-prose text-xs leading-relaxed text-fg-muted">
            &ldquo;Could move&rdquo; means this provider&rsquo;s mandate covers the kind of asset
            that would relieve the row. It is not a claim that it has funded one, or that it should.
          </p>
        </section>

        <section>
          <Heading index="03" title="The sentence this is built on" />
          <blockquote className="max-w-prose border-l-2 border-accent pl-4 text-base leading-relaxed text-fg-secondary">
            {provider.quote}
          </blockquote>
        </section>

        <p className="mt-10 text-sm">
          <Link href="/capital" className="text-accent underline-offset-4 hover:underline">
            ← All providers
          </Link>
        </p>
        {entity && <EntityProfile entity={entity} />}
      </Page>
    </Shell>
  );
}
