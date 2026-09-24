import React from 'react';
import Link from 'next/link';

import type { CompanyProfile } from '@/lib/company-profile';
import { bottleneckHref } from '@/lib/links';
import { Figure } from '@/components/portal/Figure';

/** What it is and why it matters to the chain, from the joins, not from prose. */
export function Lede({ profile }: { profile: CompanyProfile }) {
  const { participant: p, held, soleRecorded, trackedBottlenecks } = profile;
  const what = p.role ?? held.map((h) => h.step).join(', ');
  const tracked = <Figure method="bottleneck-count">{trackedBottlenecks}</Figure>;
  if (held.length === 0)
    return (
      <>
        {what}. Holds none of the {tracked} bottlenecks tracked here; listed as context for its step
        of the chain.
      </>
    );
  return (
    <>
      {what} — holds <Figure method="bottlenecks-held">{held.length}</Figure> of the {tracked}{' '}
      bottlenecks tracked here
      {soleRecorded.length > 0 && (
        <>
          , and is the only maker recorded for{' '}
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
        </>
      )}
      .
    </>
  );
}
