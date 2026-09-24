import Link from 'next/link';

import { StateBadge } from '@/components/freshness/StateBadge';
import type { FeedRow } from '@/lib/freshness/read';
import { whenLabel } from '@/lib/when';

/** "read 20m ago · FRESH", linking to the feed's row on /data/freshness. */
export function FeedStatus({ row, verb = 'read' }: { row: FeedRow | undefined; verb?: string }) {
  if (!row) return null;
  return (
    <Link href={`/data/freshness#feed-${row.feed.id}`} className="role-feed">
      {row.feed.label} {row.lastOk ? `${verb} ${whenLabel(row.lastOk)}` : 'not read yet'} ·{' '}
      <StateBadge state={row.state} />
    </Link>
  );
}

export interface Row {
  key: string;
  title: string;
  href: string;
  /** External links open the source; internal ones stay on the site. */
  external?: boolean;
  meta: string;
}

/** A plain list of titled rows, the shape most role sections need. */
export function Rows({ rows, empty }: { rows: readonly Row[]; empty: string }) {
  if (rows.length === 0) return <p className="role-empty">{empty}</p>;
  return (
    <ul className="role-rows">
      {rows.map((row) => (
        <li key={row.key}>
          {row.external ? (
            <a href={row.href} rel="noopener noreferrer" className="role-row-title">
              {row.title} ↗
            </a>
          ) : (
            <Link href={row.href} className="role-row-title">
              {row.title}
            </Link>
          )}
          <span className="role-row-meta">{row.meta}</span>
        </li>
      ))}
    </ul>
  );
}
