import Link from 'next/link';

import {
  FACILITY_KIND_LABEL,
  facilitiesFor,
  facilityById,
  type Facility,
} from '@/config/substrata-facilities';
import { resolveIn } from '../../entities/registry';
import { marketHref } from '../../links';
import { t } from '../../i18n/messages';
import type { Entity } from '../../entities/types';
import type { ProfileModule } from '../types';

function countryName(iso2: string): string {
  return resolveIn('country', iso2)?.name ?? iso2.toUpperCase();
}

/**
 * The actual places, on the page that makes the claim about them.
 *
 * "Produced only as a by-product of a few natural gas fields" named none of
 * them, so the most load-bearing sentence on the page was the one a reader
 * could do least with. Coverage is partial and says so — a named gap is still
 * better than an unnamed assertion.
 */
const places: ProfileModule<Facility[]> = {
  id: 'places',
  title: t('profile.places.title'),
  appliesTo: ['bottleneck'],
  importance: 28,
  load: (entity: Entity) => {
    if (entity.kind !== 'bottleneck') return null;
    const rows = facilitiesFor(entity.key);
    return rows.length > 0 ? rows : null;
  },
  evidence: (rows) => `${rows.length} named so far`,
  Render({ data }) {
    return (
      <>
        <ul className="divide-y divide-subtle border-y border-subtle">
          {data.map((facility) => (
            <li key={facility.id} className="py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <Link
                  href={`/facilities/${facility.id}`}
                  className="font-medium text-fg-primary underline-offset-4 hover:underline"
                >
                  {facility.name}
                </Link>
                <span className="font-mono text-xs uppercase tracking-caps text-fg-muted">
                  {FACILITY_KIND_LABEL[facility.kind]}
                </span>
              </div>
              <p className="mt-1 text-xs text-fg-tertiary">
                {facility.where}, {countryName(facility.place)}
                {facility.operator ? ' · operated by ' : ' · operator not recorded'}
                {facility.operator && (
                  <Link
                    href={marketHref(facility.operator)}
                    className="text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
                  >
                    {facility.operator}
                  </Link>
                )}
              </p>
              <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-fg-secondary">
                {facility.what}
              </p>
              <p className="mt-1 text-xs">
                <a
                  href={facility.source}
                  rel="noreferrer"
                  className="text-accent underline-offset-4 hover:underline"
                >
                  Source ↗
                </a>
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-3 max-w-prose text-xs leading-relaxed text-fg-muted">
          Named where a source names them. This is not every site that supplies this material — the
          list is as complete as the reading behind it, which is the same rule as every other row
          here.
        </p>
      </>
    );
  },
};

/** What a named place supplies, read from its own page. */
const facilitySupply: ProfileModule<Facility> = {
  id: 'facility-supply',
  title: t('profile.facilitySupply.title'),
  appliesTo: ['facility'],
  importance: 10,
  load: (entity: Entity) => (entity.kind === 'facility' ? facilityById(entity.key) : null),
  Render({ data }) {
    return (
      <>
        <p className="max-w-prose text-base leading-relaxed text-fg-secondary">{data.what}</p>
        <ul className="mt-4 divide-y divide-subtle border-y border-subtle">
          {data.makes.map((material) => {
            const entity = resolveIn('bottleneck', material);
            if (!entity) return null;
            return (
              <li key={material} className="py-3">
                <Link
                  href={entity.href}
                  className="text-fg-primary underline-offset-4 hover:underline"
                >
                  {entity.name}
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs">
          <a
            href={data.source}
            rel="noreferrer"
            className="text-accent underline-offset-4 hover:underline"
          >
            Source ↗
          </a>{' '}
          <span className="text-fg-muted">· read {data.readOn}</span>
        </p>
      </>
    );
  },
};

export { places, facilitySupply };
