/**
 * Export restrictions on one resource, read two ways: first by what the
 * measures DO (a bar per kind, so a reader sees at once whether this is a
 * banned material or a taxed one), then by who applies them, one folded row
 * per country with its count and newest date in the summary. The countries
 * with the most measures open on a wide screen; on a phone every row is
 * folded, so thirty countries are thirty lines. The hundred-line list this
 * replaced had no hierarchy at all.
 */
import { BarChart } from '@bitbaum/chartkit/react';
import { DetailsOpenWide } from '@/components/portal/DetailsOpenWide';
import { resourceLabel } from '@/config/substrata-resources';
import type { ResourceProfile } from '@/lib/resources/profile';
import { RESTRICTIONS_SOURCE } from '@/lib/resources/restrictions';
import { countryHref } from '@/lib/world/pages';
import { MeasureRows } from './MeasureRows';

/** How many countries open by themselves on a wide screen. */
const OPEN_WIDE = 5;

export function RestrictionsByKind({ profile }: { profile: ResourceProfile }) {
  const { byKind, byCountry, all } = profile.restrictions;
  const label = resourceLabel(profile.resource).toLowerCase();
  const kinds = byKind.filter((k) => k.count > 0);
  return (
    <>
      {all.length === 0 ? (
        <p className="resource-empty">
          None recorded in the inventory for {label}. {RESTRICTIONS_SOURCE.scope}
        </p>
      ) : (
        <>
          <div className="place-chart">
            <BarChart
              rows={kinds.map((k) => ({
                label: k.kind.label,
                value: k.count,
                note: `${k.countries} countr${k.countries === 1 ? 'y' : 'ies'}`,
              }))}
              unit="measures"
              highlight={[...kinds].sort((a, b) => b.count - a.count)[0]?.kind.label}
              caption={`${kinds.map((k) => `${k.kind.label}: ${k.kind.does.toLowerCase()}`).join(' ')} Counts are measures in the OECD inventory (${RESTRICTIONS_SOURCE.dataYear} data), the number of countries applying each kind on hover and in the table; one measure can cover several tariff lines.`}
            />
          </div>
          <ul className="measure-countries">
            {byCountry.map((c, i) => (
              <li key={c.iso2}>
                <DetailsOpenWide
                  id={`restrictions-${c.iso2}`}
                  className="measure-country"
                  openWide={i < OPEN_WIDE}
                  summary={
                    <>
                      <span className="measure-country-name">{c.name}</span>
                      <span className="measure-country-meta">
                        {c.count} measure{c.count === 1 ? '' : 's'}
                        {c.newest ? ` · newest ${c.newest}` : ''}
                      </span>
                    </>
                  }
                >
                  <MeasureRows groups={c.byKind} />
                  <p className="measure-country-link">
                    <a href={countryHref(c.iso2)}>What else {c.name} restricts →</a>
                  </p>
                </DetailsOpenWide>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="resource-source">
        {RESTRICTIONS_SOURCE.label},{' '}
        <span className="whitespace-nowrap">read {RESTRICTIONS_SOURCE.retrieved}</span>.{' '}
        {RESTRICTIONS_SOURCE.scope}{' '}
        <a href={RESTRICTIONS_SOURCE.url} rel="noopener noreferrer" target="_blank">
          OECD Data Explorer ↗
        </a>
      </p>
    </>
  );
}
