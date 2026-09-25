import Link from 'next/link';

import { Figure } from '@/components/portal/Figure';
import type { FeedRow } from '@/lib/freshness/read';
import { whenLabel } from '@/lib/when';
import { StateBadge } from './StateBadge';

function every(hours: number | null, onDemand: boolean): string {
  if (onDemand) return 'on demand · readers’ own keys';
  if (hours === null) return 'not scheduled';
  if (hours === 1) return 'hourly';
  if (hours === 24) return 'daily';
  return hours < 24 ? `every ${hours} h` : `every ${hours / 24} d`;
}

/** Scheduled feeds: one row each, a card per row on a phone. */
export function FeedTable({ rows, now }: { rows: FeedRow[]; now: Date }) {
  return (
    <table className="fresh-table">
      <thead>
        <tr>
          <th scope="col">Feed</th>
          <th scope="col">Status</th>
          <th scope="col">Last good run</th>
          <th scope="col">Expected</th>
          <th scope="col">Last failure</th>
          <th scope="col">Runs this week</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.feed.id} id={`feed-${row.feed.id}`}>
            <th scope="row">
              <span className="fresh-name">{row.feed.label}</span>
              <span className="fresh-what">{row.feed.what}</span>
              <Link href={row.feed.shows.href} className="fresh-shows">
                {row.feed.shows.label} →
              </Link>
            </th>
            <td data-label="Status">
              <span>
                <StateBadge state={row.state} />
                {row.note && <span className="fresh-what">{row.note}</span>}
              </span>
            </td>
            <td data-label="Last good run">
              {row.lastOk ? (
                <Figure method="freshness-age">
                  <time dateTime={row.lastOk}>{whenLabel(row.lastOk, now)}</time>
                </Figure>
              ) : (
                'never'
              )}
            </td>
            <td data-label="Expected">{every(row.everyHours, Boolean(row.feed.onDemand))}</td>
            <td data-label="Last failure">
              {row.lastFailure ? (
                <time dateTime={row.lastFailure}>{whenLabel(row.lastFailure, now)}</time>
              ) : (
                'none on record'
              )}
            </td>
            <td data-label="Runs this week" className="fresh-num">
              {row.runsThisWeek === null ? '—' : String(row.runsThisWeek)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
