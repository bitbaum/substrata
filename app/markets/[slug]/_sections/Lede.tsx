import React from 'react';
import Link from 'next/link';

import type { CompanyProfile } from '@/lib/company-profile';
import { companyExposure, headline } from '@/lib/company-exposure';
import { bottleneckHref } from '@/lib/links';

/**
 * What it is and what it is to the chain, from the joins, not from prose. The
 * second sentence is the exposure headline (lib/company-exposure): what it
 * holds, what it is exposed to, what waits on it. It never reads "holds 0".
 */
export function Lede({ profile }: { profile: CompanyProfile }) {
  const { participant: p, held, soleRecorded } = profile;
  const what = p.role ?? held.map((h) => h.step).join(', ');
  const { text } = headline(companyExposure({ slug: p.slug, name: p.name }));
  return (
    <>
      {what ? `${what}. ` : ''}
      {text}
      {soleRecorded.length > 0 && (
        <>
          {' '}
          It is the only maker recorded for{' '}
          {soleRecorded.map((h, i) => (
            <React.Fragment key={h.bottleneck.slug}>
              {i > 0 && ' and '}
              <Link
                href={bottleneckHref(h.bottleneck.slug)}
                className="text-fg-primary hover:underline"
              >
                {h.bottleneck.name}
              </Link>
            </React.Fragment>
          ))}
          .
        </>
      )}
    </>
  );
}
