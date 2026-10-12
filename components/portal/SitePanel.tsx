/**
 * One producer site, opened from its dot on the globe: who operates what
 * there and at what capacity, as USGS prints it, and how precisely the dot is
 * placed — with both sources one tap away.
 */
import Link from 'next/link';

import { countryName } from '@/app/atlas/chain-data';
import { PRECISION_LABEL, SITES_SOURCE, type Site } from '@/lib/resources/sites';

export function SiteHead({ site, closeHref }: { site: Site; closeHref: string }) {
  return (
    <div className="atlas-head-row">
      <div>
        <p className="atlas-kicker">Producer site · {countryName(site.iso2)}</p>
        <p className="atlas-title">{site.location}</p>
      </div>
      <Link className="atlas-close" href={closeHref} aria-label="Close this site">
        ×
      </Link>
    </div>
  );
}

export function SitePanel({ site, countryHref }: { site: Site; countryHref: string }) {
  return (
    <>
      <ul className="resource-list">
        {site.facilities.map((f, i) => (
          <li key={i}>
            <span className="resource-strong">{f.companies}</span> — {f.commodity.toLowerCase()}
            {f.capacity && f.capacity !== 'NA' && (
              <span className="resource-unit">
                {' '}
                capacity {f.capacity} {f.unit}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="resource-source">
        USGS Minerals Yearbook {site.year}, structure of the mineral industry. Annual capacity in
        the unit USGS prints for each commodity.{' '}
        <a href={site.chapter} rel="noopener noreferrer" target="_blank">
          Table ↗
        </a>
      </p>
      <dl className="atlas-facts">
        <div>
          <dt>Precision</dt>
          <dd>{PRECISION_LABEL[site.precision]}</dd>
        </div>
        <div>
          <dt>Year</dt>
          <dd>{site.year}</dd>
        </div>
      </dl>
      <p className="atlas-fine">
        Placed at {site.matched}.{' '}
        {site.precision === 'site'
          ? 'The dot is the facility as GeoNames records it.'
          : site.precision === 'town'
            ? 'The dot is the nearest named place USGS gives, not the facility gate.'
            : 'USGS names only the province, so the ring stands for somewhere inside it.'}{' '}
        Placed from{' '}
        <a href="https://www.geonames.org/" rel="noopener noreferrer" target="_blank">
          GeoNames
        </a>{' '}
        ({SITES_SOURCE.licence.split(' (')[0].replace('GeoNames, ', '')}).
      </p>
      <div className="atlas-actions">
        <Link href={countryHref} className="atlas-secondary" scroll={false}>
          {countryName(site.iso2)}: everything on file
        </Link>
      </div>
    </>
  );
}
