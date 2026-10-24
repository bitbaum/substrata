import React from 'react';
import Link from 'next/link';

import { EntityProfile } from '@/components/portal/EntityProfile';
import { stubEvidence } from '@/lib/entities/stub-evidence';
import type { Entity } from '@/lib/entities/types';
import { graphNode } from '@/lib/graph/index';
import { StubSources } from './StubSources';
import { correctionUrl } from '@/lib/site';
import { t } from '@/lib/i18n/messages';
import { countryHref, countryNameOf } from '@/lib/world/pages';

/**
 * A company the relation graph names and the directory holds no profile for
 * (lib/entities/sources/company-stubs.ts). Same route, same profile frame as
 * a profiled company; the only section of its own is what the sources say
 * (./StubSources.tsx): one line per relation, every source cell once.
 */
export function StubCompany({ entity }: { entity: Entity }) {
  const view = stubEvidence(entity.id);
  const count = view.groups.reduce((n, g) => n + g.rows.length, 0);
  const countries = graphNode(entity.id).iso2;
  return (
    <>
      <header className="mb-4 border-b border-subtle pb-8">
        <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
          Named in sources
          {countries.length > 0 && ' · '}
          {countries.map((iso2, i) => (
            <React.Fragment key={iso2}>
              {i > 0 && ', '}
              <Link href={countryHref(iso2)} className="tap hover:text-fg-primary hover:underline">
                {countryNameOf(iso2)}
              </Link>
            </React.Fragment>
          ))}
        </p>
        <h1 className="mt-3 max-w-3xl font-heading text-3xl font-semibold leading-tight tracking-display text-fg-primary wrap-anywhere sm:text-4xl">
          {entity.name}
        </h1>
        {entity.aka.length > 0 && (
          <p className="mt-2 text-sm text-fg-tertiary">Also printed as {entity.aka.join(', ')}</p>
        )}
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-fg-secondary">
          We hold no profile for this company yet: this page lists only what published sources say
          about it. {countries.length === 0 && 'No source states its country.'}
        </p>
        <p className="mt-3 text-sm">
          <a
            href={correctionUrl(entity.name, {
              problem: 'Evidence about a company the site holds no profile for.',
            })}
            className="tap inline-flex min-h-11 items-center text-accent underline-offset-4 hover:underline"
          >
            Send evidence about it on GitHub
          </a>
        </p>
      </header>

      <EntityProfile
        entity={entity}
        extra={[
          {
            id: 'sources-say',
            title: t('profile.stubSources.title'),
            importance: 10,
            evidence: `${count} ${count === 1 ? 'relation' : 'relations'}, each quoted`,
            node: <StubSources groups={view.groups} cells={view.cells} />,
          },
        ]}
      />
    </>
  );
}
