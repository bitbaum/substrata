/**
 * The measures inside one folded row (a country on a resource page, a
 * resource on a country page): grouped by what they do, each line the OECD
 * summary with the legal text one click away. One anatomy for both pages.
 */
import type { CountryMeasures } from '@/lib/resources/restriction-kinds';
import { restrictionParts } from '@/lib/resources/restrictions';

export function MeasureRows({ groups }: { groups: CountryMeasures['byKind'] }) {
  return (
    <div className="measure-groups">
      {groups.map((g) => (
        <div key={g.kind.id} className="measure-group">
          <h4>
            {g.kind.label} <span className="measure-count">{g.lines.length}</span>
          </h4>
          <ul className="measure-lines">
            {g.lines.map(({ measure }, i) => {
              const { head, since, until } = restrictionParts(measure);
              return (
                <li key={i}>
                  {head}
                  {since && (
                    <>
                      {' '}
                      since <span className="whitespace-nowrap">{since}</span>
                    </>
                  )}
                  {until && (
                    <>
                      , until <span className="whitespace-nowrap">{until}</span>
                    </>
                  )}
                  {measure.link && (
                    <>
                      {' '}
                      <a href={measure.link} rel="noopener noreferrer" target="_blank">
                        {measure.document ? 'Legal text' : 'Source'} ↗
                      </a>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
