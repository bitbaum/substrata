/** Export restrictions on one resource, grouped by the country that applies them (OECD inventory). */
import { resourceLabel } from '@/config/substrata-resources';
import { WORLD_PATHS } from '@/config/world-paths';

const nameOf = (iso2: string) =>
  WORLD_PATHS.find((p) => p.iso2 === iso2)?.name ?? iso2.toUpperCase();
import {
  RESTRICTIONS_SOURCE,
  restrictionSummary,
  restrictionsOn,
} from '@/lib/resources/restrictions';

export function RestrictionsByCountry({ resource }: { resource: string }) {
  const rows = restrictionsOn(resource);
  const byCountry = new Map<string, typeof rows>();
  for (const m of rows) byCountry.set(m.iso2, [...(byCountry.get(m.iso2) ?? []), m]);
  return (
    <section className="mt-6">
      <h2>Export restrictions on {resourceLabel(resource).toLowerCase()}</h2>
      <p className="resource-line">
        {RESTRICTIONS_SOURCE.label}. {RESTRICTIONS_SOURCE.scope}{' '}
        <a href={RESTRICTIONS_SOURCE.url} rel="noopener noreferrer" target="_blank">
          OECD Data Explorer ↗
        </a>
      </p>
      {byCountry.size === 0 ? (
        <p className="resource-empty">None recorded in the inventory for this resource.</p>
      ) : (
        <ul className="resource-list">
          {[...byCountry.entries()].map(([iso2, measures]) => (
            <li key={iso2} id={`restrictions-${iso2}`}>
              <span className="resource-strong">{nameOf(iso2)}</span>
              <ul>
                {measures.map((m, i) => (
                  <li key={i}>
                    {restrictionSummary(m)}{' '}
                    {m.link && (
                      <a href={m.link} rel="noopener noreferrer" target="_blank">
                        {m.document ?? 'Legal text'} ↗
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
