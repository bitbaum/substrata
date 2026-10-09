import React from 'react';
import Link from 'next/link';

import type { PolicyTotals } from '@/config/substrata-policy';
import { SCIENCE } from '@/config/substrata-science';
import type { PortalTotals } from '@/lib/bottlenecks';
import type { MarketTotals } from '@/lib/participants';
import { Figure } from '@/components/portal/Figure';

/** The four headline counts, each a door into the section that holds the rows. */
export function HomeStats({
  totals,
  markets,
  policy,
}: {
  totals: PortalTotals;
  markets: MarketTotals;
  policy: PolicyTotals;
}) {
  const bothWays = policy.instruments - policy.tightening - policy.loosening;
  const tiles: {
    label: string;
    value: React.ReactNode;
    note: React.ReactNode;
    href: string;
    more: string;
  }[] = [
    {
      label: 'Bottlenecks mapped',
      value: (
        <Figure className="figure-target" method="bottleneck-count">
          {totals.bottlenecks}
        </Figure>
      ),
      note: (
        <>
          <Figure className="figure-target" method="binding-now">
            {totals.bindingNow}
          </Figure>{' '}
          judged to be binding right now
        </>
      ),
      href: '/bottlenecks',
      more: 'See them all',
    },
    {
      label: 'Maker rows sourced',
      value: (
        <Figure className="figure-target" method="sourced-rows">
          {totals.sourced}/{totals.producers}
        </Figure>
      ),
      note: (
        <>
          <Figure className="figure-target" method="organisations">
            {markets.organisations}
          </Figure>{' '}
          organisations in the directory
        </>
      ),
      href: '/data',
      more: 'What sourced means',
    },
    {
      label: 'Rules tracked',
      value: (
        <Figure className="figure-target" method="rules-tracked">
          {policy.instruments}
        </Figure>
      ),
      note: (
        <>
          <Figure className="figure-target" method="rule-direction">
            {policy.tightening}
          </Figure>{' '}
          slow building,{' '}
          <Figure className="figure-target" method="rule-direction">
            {policy.loosening}
          </Figure>{' '}
          speed it
          {bothWays > 0 && (
            <>
              ,{' '}
              <Figure className="figure-target" method="rule-direction">
                {bothWays}
              </Figure>{' '}
              both ways
            </>
          )}
        </>
      ),
      href: '/policy',
      more: 'Read the rules',
    },
    {
      label: 'Possible fixes',
      value: (
        <Figure className="figure-target" method="possible-fixes">
          {SCIENCE.length}
        </Figure>
      ),
      note: 'technologies argued to relieve a constraint',
      href: '/science',
      more: 'See the science',
    },
  ];

  return (
    <dl className="mb-12 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-subtle bg-border-subtle lg:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.label} className="bg-surface-raised px-4 py-4 sm:px-5">
          <dt className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
            {tile.label}
          </dt>
          <dd className="mt-2 font-heading text-3xl font-semibold tabular-nums text-fg-primary sm:text-4xl">
            {tile.value}
          </dd>
          <dd className="mt-1 text-xs leading-snug text-fg-muted">{tile.note}</dd>
          <dd className="mt-2 text-xs">
            <Link
              href={tile.href}
              className="link-target text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
            >
              {tile.more} →
            </Link>
          </dd>
        </div>
      ))}
    </dl>
  );
}
