/**
 * Market access, country level: the sanctions regimes that name the country
 * (EU register, OFAC programs) with what they apply — measure types, not a
 * verdict — and how many export restrictions the OECD records it applying.
 */
import { Figure } from '../Figure';
import {
  euRegimesFor,
  measureTypes,
  ofacProgramsFor,
  SANCTIONS_SOURCE,
} from '@/lib/resources/sanctions';
import { RESTRICTIONS_SOURCE, inInventory, restrictionsFor } from '@/lib/resources/restrictions';
import { resourceLabel } from '@/config/substrata-resources';

export function CountryAccess({ iso2 }: { iso2: string }) {
  const eu = euRegimesFor(iso2);
  const us = ofacProgramsFor(iso2);
  const restrictions = restrictionsFor(iso2);
  const resources = [...new Set(restrictions.map((r) => r.resource))];
  return (
    <section className="mt-5 country-access">
      <h3>Market access</h3>
      <h4>Export restrictions it applies</h4>
      {restrictions.length > 0 ? (
        <p className="resource-line">
          <Figure source={RESTRICTIONS_SOURCE.url} sourceLabel={RESTRICTIONS_SOURCE.label}>
            {String(restrictions.length)}
          </Figure>{' '}
          measures recorded on {resources.map(resourceLabel).join(', ').toLowerCase()} — listed
          under each resource above.
        </p>
      ) : (
        <p className="resource-empty">
          {inInventory(iso2) ? 'None recorded on the resources tracked here' : 'Not covered by'} (
          {RESTRICTIONS_SOURCE.label}).
        </p>
      )}
      <h4>Sanctions that name it</h4>
      {eu.length + us.length === 0 ? (
        <p className="resource-empty">
          No EU regime and no OFAC country program. Thematic lists (terrorism, cyber, human rights)
          can still name its people and companies.
        </p>
      ) : (
        <ul className="resource-list">
          {eu.map((r) => (
            <li key={r.id}>
              <span className="resource-strong">{r.adoptedBy === 'EU' ? 'EU' : r.adoptedBy}</span> ·{' '}
              {r.title}
              <span className="resource-unit">
                {' '}
                Applies: {measureTypes(r).join(', ').toLowerCase()}
                {r.amended && `. Amended ${r.amended}`}.
              </span>{' '}
              <a href={r.url} rel="noopener noreferrer" target="_blank">
                EU Sanctions Map ↗
              </a>
            </li>
          ))}
          {us.map((p) => (
            <li key={p.url}>
              <span className="resource-strong">US</span> · {p.title}{' '}
              <a href={p.url} rel="noopener noreferrer" target="_blank">
                OFAC ↗
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="resource-source">
        Read {SANCTIONS_SOURCE.retrieved} from the{' '}
        <a href={SANCTIONS_SOURCE.eu.url} rel="noopener noreferrer" target="_blank">
          EU Sanctions Map
        </a>{' '}
        and{' '}
        <a href={SANCTIONS_SOURCE.us.url} rel="noopener noreferrer" target="_blank">
          OFAC’s program list
        </a>
        . A regime targets what its measures name — listed persons, goods, services — not the whole
        country. {SANCTIONS_SOURCE.gaps.join(' ')}
      </p>
    </section>
  );
}
