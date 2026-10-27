import React, { Suspense } from 'react';
import Link from 'next/link';

import { EntityProfile, type ExtraSection } from '@/components/portal/EntityProfile';
import { TIERS, themeById } from '@/config/universe-themes';
import { stubEvidence } from '@/lib/entities/stub-evidence';
import type { Entity } from '@/lib/entities/types';
import { correctionUrl } from '@/lib/site';
import { t } from '@/lib/i18n/messages';
import { MARKET_DATA_SECTIONS, marketDataKey } from '@/lib/universe/market-data-seam';
import { marketSections } from '@/components/company/marketSections';
import { Quote, QuoteLoading } from '@/components/company/Quote';
import type { UniverseEntry } from '@/lib/universe/types';
import { countryHref, countryNameOf } from '@/lib/world/pages';
import { whySentence } from '@/lib/universe/why-sentence';
import { Admissions } from './Admissions';
import { StubSources } from './StubSources';

const CAPS = 'font-mono text-xs uppercase tracking-caps text-fg-tertiary';

/**
 * A tier B company: identified, not profiled (lib/universe). Same route and
 * frame as every company. It shows what admits it — identity, theme, size,
 * each quoted — and says plainly that no role in any chain is claimed. The
 * market-data workstream adds its sections through lib/universe/market-data-seam.ts.
 */
export function IdentifiedCompany({ entity, entry }: { entity: Entity; entry: UniverseEntry }) {
  const tier = TIERS.find((x) => x.tier === 'B')!;
  const key = marketDataKey(entry);
  const relations = stubEvidence(entity.id);
  const relationCount = relations.groups.reduce((n, g) => n + g.rows.length, 0);
  const extra: ExtraSection[] = [
    {
      id: 'why-in',
      title: 'Why it is in Substrata',
      // After the market frame (price, key statistics, financials).
      importance: 9,
      evidence: `${entry.admittedBy.length} cited rows`,
      node: <Admissions admittedBy={entry.admittedBy} />,
    },
    ...marketSections({ slug: entry.slug, name: entity.name }),
    ...(key
      ? MARKET_DATA_SECTIONS.flatMap((s) => {
          const node = s.render(key);
          return node
            ? [{ id: s.id, title: s.title, importance: s.importance, evidence: s.evidence, node }]
            : [];
        })
      : []),
    ...(relationCount
      ? [
          {
            id: 'sources-say',
            title: t('profile.stubSources.title'),
            importance: 10,
            evidence: `${relationCount} ${relationCount === 1 ? 'relation' : 'relations'}, each quoted`,
            node: <StubSources groups={relations.groups} cells={relations.cells} />,
          },
        ]
      : []),
  ];
  return (
    <>
      <header className="mb-4 border-b border-subtle pb-8">
        <p className={CAPS}>
          {tier.label}, not profiled
          {entry.country && (
            <>
              {' · '}
              <Link
                href={countryHref(entry.country.toLowerCase())}
                className="tap hover:text-fg-primary hover:underline"
              >
                {countryNameOf(entry.country.toLowerCase())}
              </Link>
            </>
          )}
        </p>
        <h1 className="mt-3 max-w-3xl font-heading text-3xl font-semibold leading-tight tracking-display text-fg-primary wrap-anywhere sm:text-4xl">
          {entity.name}
        </h1>
        <Suspense fallback={<QuoteLoading />}>
          <Quote slug={entry.slug} />
        </Suspense>
        {entity.aka.length > 0 && (
          <p className="mt-2 text-sm text-fg-tertiary wrap-anywhere">
            Also printed as {entity.aka.slice(0, 4).join(', ')}
          </p>
        )}
        <p className="mt-4 text-sm text-fg-secondary">
          Themes:{' '}
          {entry.themes.map((id, i) => (
            <React.Fragment key={id}>
              {i > 0 && ', '}
              <Link
                href={`/data/companies#theme-${id}`}
                className="tap text-fg-primary underline-offset-4 hover:underline"
              >
                {themeById(id)!.label}
              </Link>
            </React.Fragment>
          ))}
        </p>
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-fg-primary">
          <span className="font-semibold">Why it is here: </span>
          {whySentence(entry)}
        </p>
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-fg-secondary">
          {tier.means} A thematic fund holding it shows interest in the theme, not a part in any
          supply chain.{' '}
          <Link href="/data/companies" className="text-accent underline-offset-4 hover:underline">
            How companies are chosen
          </Link>
          .
        </p>
        <p className="mt-3 text-sm">
          <a
            href={correctionUrl(entity.name, {
              problem: 'Evidence about a company identified but not profiled.',
            })}
            className="tap inline-flex min-h-11 items-center text-accent underline-offset-4 hover:underline"
          >
            Send evidence about it on GitHub
          </a>
        </p>
      </header>
      <EntityProfile entity={entity} extra={extra} />
    </>
  );
}
