import React, { Suspense } from 'react';
import Link from 'next/link';

import type { MarketParticipant } from '@/lib/participants';
import { correctionUrl } from '@/lib/site';
import type { CompanyProfile } from '@/lib/company-profile';
import { hostOf } from '@/lib/desk';
import { FollowButton } from '@/components/portal/FollowButton';
import { AtAGlance } from './AtAGlance';
import { Lede } from './Lede';
import { CheckThis } from '@/components/portal/CheckThis';
import { Quote, QuoteLoading } from '@/components/company/Quote';

/**
 * The header is derived. Every figure in it links to the rows it counts or to
 * the assessment it sums, and the evidence note is one line rather than a
 * warning box, because the sections below carry each row's own evidence.
 */
export function CompanyHeader({
  p,
  profile,
  layerName,
  signedIn,
  following,
  listed = false,
}: {
  p: MarketParticipant;
  profile: CompanyProfile;
  layerName: string | undefined;
  signedIn: boolean;
  following: boolean;
  /**
   * A listed company reads like a quote page: name, quote, then the share
   * price straight under it. Its role in the chain (the lede, the five tiles,
   * the grade and its source) moves below Key statistics as its own section,
   * "Role in the chain" (page.tsx). Every other company keeps it here, where
   * it is the most there is to say.
   */
  listed?: boolean;
}) {
  return (
    <header className="mb-4 border-b border-subtle pb-8">
      <p className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
        {layerName}
        {profile.places.length > 0 && ' · '}
        {profile.places.map((place, i) => (
          <React.Fragment key={place.code}>
            {i > 0 && ', '}
            {place.href ? (
              <Link href={place.href} className="hover:text-fg-primary hover:underline">
                {place.name}
              </Link>
            ) : (
              place.name
            )}
          </React.Fragment>
        ))}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <h1 className="max-w-3xl font-heading text-3xl font-semibold leading-tight tracking-display text-fg-primary sm:text-4xl">
          {p.name}
        </h1>
        {signedIn && (
          <FollowButton type="company" id={p.slug} following={following} label={p.name} />
        )}
      </div>
      <Suspense fallback={<QuoteLoading />}>
        <Quote slug={p.slug} />
      </Suspense>
      <p className="mt-2 text-sm">
        <a href="#take-part" className="text-xs text-accent hover:underline">
          Work there, own part of it, buy from it ↓
        </a>
      </p>
      {!listed && <ChainRole p={p} profile={profile} />}
    </header>
  );
}

/**
 * What the company is to the chain: the lede, the five tiles at a glance, why
 * it is graded so, and where its role is cited from. In the header for a
 * company with no listed share; a section of its own below Key statistics
 * for a listed one.
 */
export function ChainRole({ p, profile }: { p: MarketParticipant; profile: CompanyProfile }) {
  const citation = p.directorySource ?? p.existenceVerifiedBy?.url ?? null;
  return (
    <>
      <p className="mt-3 max-w-prose text-lg leading-relaxed text-fg-secondary">
        <Lede profile={profile} />
        <CheckThis className="is-inline" label="Check this" />
      </p>

      <AtAGlance p={p} profile={profile} />

      {p.why && (
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-fg-tertiary">
          <span className="font-mono text-xs uppercase tracking-caps">Why graded so · </span>
          {p.why}
        </p>
      )}
      <p className="mt-3 max-w-prose text-xs leading-relaxed text-fg-muted">
        {citation ? (
          <>
            Role cited from{' '}
            <a href={citation} rel="noreferrer" className="text-accent hover:underline">
              {hostOf(citation)} ↗
            </a>
            .{' '}
          </>
        ) : (
          'Role not yet sourced; a lead, not a finding. '
        )}
        {p.scarcity && 'The grade is this project’s judgement. '}
        <a href={correctionUrl(p.name)} className="text-accent hover:underline">
          Report an error
        </a>
      </p>
    </>
  );
}
