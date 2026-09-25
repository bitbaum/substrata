/**
 * A country's resources, largest share of world output first, each opening
 * onto its figures and what surrounds them. Replaces the directory chips,
 * which said a country "has" a resource without saying how much.
 */
import Link from 'next/link';
import { Figure } from '../Figure';
import { ResourceFigures } from './ResourceFigures';
import { ResourceContext } from './ResourceContext';
import { countryResources, leadOf, type ResourceFacts } from '@/lib/resources/country';
import { formatShare, ordinal } from '@/lib/resources/format';
import { ENERGY_GAPS } from '@/lib/resources/usgs';

/** Open the first few; the rest stay one click away. */
const OPEN = 2;

function Headline({ facts }: { facts: ResourceFacts }) {
  const lead = leadOf(facts.production) ?? facts.production[0];
  if (!lead || lead.current.rank === null)
    return <span className="resource-unit">{lead ? lead.current.text : 'reserves only'}</span>;
  return (
    <span className="resource-unit">
      <Figure method="world-rank" inLink>
        {ordinal(lead.current.rank)}
      </Figure>
      {lead.current.share !== null && (
        <>
          {' · '}
          <Figure method="share" inLink>
            {formatShare(lead.current.share)}
          </Figure>
        </>
      )}{' '}
      of {lead.label.toLowerCase()}, {lead.year}
    </span>
  );
}

export function CountryResources({ iso2, selected }: { iso2: string; selected?: string }) {
  const { measured, unmeasured } = countryResources(iso2);
  const selectedFirst = selected
    ? [
        ...measured.filter((m) => m.resource === selected),
        ...measured.filter((m) => m.resource !== selected),
      ]
    : measured;
  return (
    <section className="mt-5 country-resources">
      <h3>Natural resources, measured</h3>
      {measured.length === 0 ? (
        <p className="resource-empty">
          No USGS or EIA production or reserves table lists this country individually.
        </p>
      ) : (
        <>
          <p className="resource-line">
            Ordered by the country’s largest{' '}
            <Figure method="resource-significance">share of world output</Figure>. Values are USGS
            (minerals) or EIA (energy); an “e” marks a USGS estimate.
          </p>
          {selectedFirst.map((facts, i) => (
            <details
              key={facts.resource}
              className="resource-item"
              open={facts.resource === selected || (!selected && i < OPEN)}
            >
              <summary>
                <span className="resource-strong">{facts.label}</span> <Headline facts={facts} />
              </summary>
              <ResourceFigures facts={facts} />
              <ResourceContext iso2={iso2} resource={facts.resource} />
              <p className="resource-source">
                {facts.source.label}, {facts.source.table} ({facts.source.unitQuote}).{' '}
                <a href={facts.source.url} rel="noopener noreferrer" target="_blank">
                  Source ↗
                </a>{' '}
                <Link href={`/resources/${facts.resource}`}>World ranking →</Link>
              </p>
            </details>
          ))}
        </>
      )}
      {unmeasured.length > 0 && (
        <p className="resource-line">
          Also named in the directory, with no production table for this country:{' '}
          {unmeasured.map((r, i) => (
            <span key={r.id}>
              {i > 0 && ', '}
              {r.label}
              {!r.hasTable && ' (no open table read)'}
            </span>
          ))}
          .
        </p>
      )}
      {unmeasured.some((r) => !r.hasTable) && (
        <p className="resource-source">Gaps: {ENERGY_GAPS.join(' ')}</p>
      )}
    </section>
  );
}
