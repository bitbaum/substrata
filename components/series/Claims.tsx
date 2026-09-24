import React from 'react';
import Link from 'next/link';

import { Figure } from '@/components/portal/Figure';
import type { Claim } from '@/lib/claims';
import { seriesHref } from '@/lib/links';
import { formatPoint, periodLabel, seriesById, type Series } from '@/lib/series';

/**
 * What the page's prose claims, and the number that measures it.
 *
 * A sentence like "lead times run past two years" is only as good as the
 * figure behind it; this puts the two side by side. Where the old wording went
 * further than any source, it was cut back, and the row says what it used to
 * claim.
 */
export function Claims({ claims, series }: { claims: Claim[]; series: Series[] }) {
  if (claims.length === 0) return null;
  return (
    <div className="series-claims">
      <p className="series-key-kind">What the text on this page claims, and the number behind it</p>
      <ul>
        {claims.map((claim) => (
          <li key={claim.text}>
            <p className="series-claim-text">
              <q>{claim.text}</q>{' '}
              <span className={`series-claim-verdict series-claim-${claim.verdict}`}>
                {claim.verdict === 'measured' ? 'Measured' : 'Softened — no source for more'}
              </span>
            </p>
            <p className="series-claim-how">{claim.how}</p>
            {claim.series.length > 0 && (
              <p className="series-claim-numbers">
                {claim.series.map((id) => {
                  const s = seriesById(series, id);
                  const last = s?.points[s.points.length - 1];
                  if (!s || !last) return null;
                  return (
                    <span key={id}>
                      <Link href={seriesHref(id)}>{s.metric}</Link>:{' '}
                      <Figure source={last.source} sourceLabel={last.publisher}>
                        {formatPoint(last)}
                      </Figure>{' '}
                      {s.unit}, {periodLabel(last.date)}
                    </span>
                  );
                })}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
