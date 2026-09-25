import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { FACILITIES, FACILITY_KIND_LABEL, facilityById } from '@/config/substrata-facilities';
import { correctionUrl } from '@/lib/site';
import { Page, Shell } from '@/components/portal/Shell';
import { EntityProfile } from '@/components/portal/EntityProfile';
import { resolveIn } from '@/lib/entities/registry';
import { marketHref } from '@/lib/links';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return FACILITIES.map((facility) => ({ slug: facility.id }));
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const facility = facilityById(slug);
  return facility ? { title: facility.name, description: facility.what.slice(0, 160) } : {};
}

/**
 * One named place.
 *
 * The corpus used to say "a few gas fields" and name none of them. A place with
 * a page is a claim a reader can follow, argue with and correct.
 */
export default async function FacilityPage({ params }: RouteParams) {
  const { slug } = await params;
  const facility = facilityById(slug);
  if (!facility) notFound();

  const entity = resolveIn('facility', facility.id);
  const country = resolveIn('country', facility.place);

  return (
    <Shell>
      <Page>
        <nav className="mb-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary">
          <Link href="/bottlenecks" className="hover:text-fg-primary">
            Bottlenecks
          </Link>
          <span className="mx-2">/</span>
          {FACILITY_KIND_LABEL[facility.kind]}
        </nav>

        <header className="mb-8 border-b border-subtle pb-8">
          <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
            {FACILITY_KIND_LABEL[facility.kind]} · {facility.where}
          </p>
          <h1 className="mt-3 max-w-3xl font-heading text-3xl font-semibold leading-tight tracking-display text-fg-primary sm:text-4xl">
            {facility.name}
          </h1>
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {country && (
              <Link
                href={country.href}
                className="text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
              >
                {country.name}
              </Link>
            )}
            {facility.operator ? (
              <Link
                href={marketHref(facility.operator)}
                className="text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
              >
                Operated by {facility.operator}
              </Link>
            ) : (
              <span className="text-fg-muted">Operator not recorded</span>
            )}
            <a
              href={correctionUrl(facility.name)}
              className="text-accent underline-offset-4 hover:underline"
            >
              Report an error on GitHub
            </a>
          </div>
        </header>

        {entity && <EntityProfile entity={entity} />}

        <p className="mt-12 text-sm">
          <Link href="/bottlenecks" className="text-accent underline-offset-4 hover:underline">
            ← All bottlenecks
          </Link>
        </p>
      </Page>
    </Shell>
  );
}
