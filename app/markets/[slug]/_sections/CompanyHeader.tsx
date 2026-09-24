import React from 'react';
import Link from 'next/link';

import type { MarketParticipant } from '@/lib/participants';
import { correctionUrl } from '@/lib/site';
import type { CompanyProfile } from '@/lib/company-profile';
import { hostOf } from '@/lib/desk';
import { FollowButton } from '@/components/portal/FollowButton';
import { CompanyFacts } from './CompanyFacts';
import { Lede } from './Lede';
import { Ticker } from '@/components/exposure/Ticker';
import { listingFor } from '@/lib/listings';

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
}: {
  p: MarketParticipant;
  profile: CompanyProfile;
  layerName: string | undefined;
  signedIn: boolean;
  following: boolean;
}) {
  const citation = p.directorySource ?? p.existenceVerifiedBy?.url ?? null;
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
      <p className="mt-2 text-sm">
        <Ticker listing={listingFor(p.slug) ?? null} />
      </p>
      <p className="mt-3 max-w-prose text-lg leading-relaxed text-fg-secondary">
        <Lede profile={profile} />
      </p>

      <CompanyFacts p={p} profile={profile} />

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
    </header>
  );
}
