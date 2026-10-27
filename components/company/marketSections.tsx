import React, { Suspense } from 'react';

import type { ExtraSection } from '@/components/portal/EntityProfile';
import { COMPANY_SECTION_IMPORTANCE } from '@/lib/company-sections';
import { marketCompanyFor } from '@/lib/market-data/company';
import { participantBySlug } from '@/lib/participants';
import { Business } from './Business';
import { Financials } from './Financials';
import { Holders } from './Holders';
import { KeyStats } from './KeyStats';
import { SectionLoading } from './parts';
import { Peers } from './Peers';
import { PriceSection } from './PriceSection';

/**
 * The market frame every company page carries, in one order whatever the
 * company is (docs/design/company-page.md): share price, key statistics,
 * financials, who owns it, how it does business, peers. Each section streams
 * in its own Suspense boundary, so a slow price source holds up only the
 * sections that need prices, never the header or each other. A section with
 * nothing to show says what would fill it rather than disappearing.
 */
export function marketSections({ slug, name }: { slug: string; name: string }): ExtraSection[] {
  const listed = marketCompanyFor(slug) !== null;
  const lazy = (what: string, node: React.ReactNode) => (
    <Suspense fallback={<SectionLoading what={what} />}>{node}</Suspense>
  );
  const I = COMPANY_SECTION_IMPORTANCE;
  return [
    {
      id: 'price',
      title: 'Share price',
      importance: I.price,
      evidence: listed ? 'delayed end-of-day closes' : 'no listing known',
      node: lazy('closing prices', <PriceSection slug={slug} name={name} />),
    },
    {
      id: 'key-stats',
      title: 'Key statistics',
      importance: I['key-stats'],
      evidence: listed ? 'latest annual figures, each from its filing' : 'no filings known',
      node: lazy('the filings', <KeyStats slug={slug} name={name} />),
    },
    {
      id: 'financials',
      title: 'Revenue and net income by year',
      importance: I.financials,
      evidence: listed ? 'from XBRL filings' : 'no filings known',
      node: lazy('the filings', <Financials slug={slug} name={name} />),
    },
    // A profiled company with no listing keeps the directory's ownership
    // module (who owns a private firm or a subsidiary IS the answer there).
    ...(listed || !participantBySlug(slug)
      ? [
          {
            id: 'ownership',
            title: 'Who owns it',
            importance: I.ownership,
            evidence: listed ? 'holders named in filings, each dated' : 'no listing known',
            node: lazy('the ownership filings', <Holders slug={slug} name={name} />),
          },
        ]
      : []),
    {
      id: 'business',
      title: 'How it does business',
      importance: I.business,
      evidence: 'customers, suppliers, competitors, from the relation graph',
      node: <Business id={`company:${slug}`} name={name} />,
    },
    {
      id: 'peers',
      title: 'Peers by share price',
      importance: I.peers,
      evidence: 'listed companies at the same step or in the same theme',
      node: lazy('peer prices', <Peers slug={slug} name={name} />),
    },
  ];
}
