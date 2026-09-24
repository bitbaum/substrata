import { Figure } from '@/components/portal/Figure';
import type { DatasetRow } from '@/lib/freshness/read';
import { codeHref } from '@/lib/methods';
import { StateBadge } from './StateBadge';

/** Committed files: the date each says it was checked, against the age it may reach. */
export function DatasetTable({ rows }: { rows: DatasetRow[] }) {
  return (
    <table className="fresh-table">
      <thead>
        <tr>
          <th scope="col">Dataset</th>
          <th scope="col">Status</th>
          <th scope="col">Checked on</th>
          <th scope="col">Age</th>
          <th scope="col">Allowed</th>
          <th scope="col">How it is refreshed</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.dataset.id} id={`dataset-${row.dataset.id}`}>
            <th scope="row">
              <span className="fresh-name">{row.dataset.label}</span>
              <a
                href={codeHref(row.dataset.file)}
                className="fresh-shows"
                rel="noopener noreferrer"
              >
                {row.dataset.file}
              </a>
            </th>
            <td data-label="Status">
              <StateBadge state={row.state} />
            </td>
            <td data-label="Checked on">{row.dataset.checkedOn || 'no date'}</td>
            <td data-label="Age" className="fresh-num">
              <Figure method="freshness-age">
                {Number.isFinite(row.ageDays) ? `${row.ageDays} d` : '—'}
              </Figure>
            </td>
            <td data-label="Allowed" className="fresh-num">
              {`${row.dataset.maxAgeDays} d`}
            </td>
            <td data-label="Refreshed by">
              <code className="fresh-code">{row.dataset.refresh}</code>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
