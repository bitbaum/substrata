import { Figure } from '@/components/portal/Figure';
import type { DatasetRow } from '@/lib/freshness/read';
import { codeHref } from '@/lib/methods';
import { StateBadge } from './StateBadge';
import type { Unconfirmed as UnconfirmedRow } from '@/lib/freshness/unconfirmed';

/** Rows a re-check tried and could not confirm: named, with why, never counted as fresh. */
function Unconfirmed({ list }: { list: readonly UnconfirmedRow[] }) {
  return (
    <>
      <p className="fresh-what">
        Not confirmed — {list.length} row{list.length === 1 ? '' : 's'} tried and not verified; the
        dates above do not cover {list.length === 1 ? 'it' : 'them'}:
      </p>
      <ul className="fresh-unconfirmed-list">
        {list.map((u) => (
          <li key={u.id}>
            <code className="fresh-code">{u.id}</code> — {u.reason} (tried {u.triedOn})
          </li>
        ))}
      </ul>
    </>
  );
}

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
        {rows.map((row) => [
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
          </tr>,
          row.dataset.unconfirmed?.length ? (
            <tr key={`${row.dataset.id}-unconfirmed`} className="fresh-unconfirmed">
              <td colSpan={6}>
                <Unconfirmed list={row.dataset.unconfirmed} />
              </td>
            </tr>
          ) : null,
        ])}
      </tbody>
    </table>
  );
}
