import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CAPITAL_PROVIDERS, kindById, providerById } from '@/config/substrata-capital';
import { JURISDICTION_LABEL, hasPolicyPage } from '@/config/substrata-policy';
import { policyHref } from '@/lib/links';
import { correctionUrl } from '@/lib/site';
import { Page, Shell } from '@/components/portal/Shell';
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

/**
 * One capital provider: its identity and sourcing, then the shared modules.
 *
 * What this kind of money does, what it could move and the sentence the entry
 * rests on are modules now.
 */
export default async function ProviderPage({ params }: RouteParams) {
  const { slug } = await params;
  const provider = providerById(slug);
  if (!provider) notFound();

  const kind = kindById(provider.kind);
  const entity = resolveIn('capital', provider.id);

  return (
    <Shell>
      <Page>
        <nav
          aria-label="Breadcrumb"
          className="crumbs mb-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary"
        >
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

        {entity && <EntityProfile entity={entity} />}

        <p className="mt-12 text-sm">
          <Link href="/capital" className="text-accent underline-offset-4 hover:underline">
            ← All providers
          </Link>
        </p>
      </Page>
    </Shell>
  );
}
