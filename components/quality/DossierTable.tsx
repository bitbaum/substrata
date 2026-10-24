import { computeDossier, type Dossier } from '@/lib/dossier/compute';
import { PRIORITY_COUNTRIES, boxesFor } from '@/lib/dossier/definitions';
import type { BoxStatus } from '@/lib/graph/types';

const BAND: Record<BoxStatus, 'good' | 'fair' | 'poor'> = {
  full: 'good',
  thin: 'fair',
  empty: 'poor',
};

/**
 * The owner's priority countries against every country box: full, thin or
 * empty, computed by lib/dossier from the rows that exist. Same table shape
 * as the scores above, so on a phone each country stacks into labelled rows.
 */
export function DossierTable() {
  const boxes = boxesFor('country');
  const rows = PRIORITY_COUNTRIES.map((iso2) => computeDossier(`country:${iso2}`)).filter(
    (d): d is Dossier => d !== null,
  );
  return (
    <table className="fresh-table quality-table quality-dossier">
      <thead>
        <tr>
          <th scope="col">Country</th>
          {boxes.map((b) => (
            <th scope="col" key={b.id}>
              {b.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((d) => (
          <tr key={d.subject.id}>
            <th scope="row">
              <a className="fresh-name" href={`${d.subject.href}#dossier`}>
                {d.subject.name}
              </a>
            </th>
            {d.boxes.map((b) => (
              <td
                key={b.box}
                data-label={b.label}
                className={`fresh-num quality-cell is-${BAND[b.status]}`}
                title={b.missing ?? b.counts.basis}
              >
                <span>
                  {b.status}
                  <span className="quality-na"> · {b.counted}</span>
                </span>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
