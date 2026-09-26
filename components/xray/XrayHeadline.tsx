/**
 * The first thing the X-ray says: the biggest single-source risk in the
 * pasted weight and the country the most weight rests on alone. The tables
 * below hold the same numbers; this says which one matters most, first.
 */
import Link from 'next/link';

import { Figure } from '@/components/portal/Figure';
import { bottleneckHref } from '@/lib/links';
import { topCountry, topSingleSourceRisk } from '@/lib/xray/headline';
import type { PortfolioXray } from '@/lib/xray/portfolio';
import { countryLabel } from './XrayHolding';

const pct = (share: number) => `${Math.round(share * 100)}%`;

export function XrayHeadline({ data }: { data: PortfolioXray }) {
  const risk = topSingleSourceRisk(data);
  const country = topCountry(data);
  const heaviest = data.rails[0];
  return (
    <dl className="xray-headline">
      <div>
        <dt>Biggest single-source risk</dt>
        {risk ? (
          <dd>
            <strong>{risk.company}</strong> is the only recorded maker of{' '}
            <Link href={bottleneckHref(risk.slug)}>{risk.bottleneck}</Link>:{' '}
            <Figure method="xray-weight">{pct(risk.weight)}</Figure> of your weight rests on it, via{' '}
            {risk.holdings.join(', ')}.
          </dd>
        ) : (
          <dd>No bottleneck under these holdings has a single recorded maker.</dd>
        )}
      </div>
      <div>
        <dt>Most weight on one country</dt>
        {country ? (
          <dd>
            <strong>{countryLabel(country.country)}</strong>:{' '}
            <Figure method="xray-country">{pct(country.weight)}</Figure> of your weight rests on
            bottlenecks made only there ({country.rails.join(', ')}).
          </dd>
        ) : (
          <dd>No bottleneck here is made in one country only.</dd>
        )}
      </div>
      {heaviest && (
        <div>
          <dt>Most-shared bottleneck</dt>
          <dd>
            <Link href={bottleneckHref(heaviest.slug)}>{heaviest.bottleneck}</Link>:{' '}
            <Figure method="xray-weight">{pct(heaviest.weight)}</Figure> of your weight touches it.
          </dd>
        </div>
      )}
    </dl>
  );
}
