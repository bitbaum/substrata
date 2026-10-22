import Link from 'next/link';

import { whenLabel } from '@/lib/desk';
import type { Freshness } from '@/lib/sweep-queue';

/**
 * The footer's one freshness line: when the sweep last ran and how much it
 * holds unchecked, then the way to the full account. It says whether anyone
 * is still looking — never a record date dressed as freshness
 * (test/sweep.test.ts). Said plainly; a count of feeds "needing attention" is
 * the data-quality page's to explain, and the link goes there.
 */
export function HomeStatus({ freshness, now }: { freshness: Freshness | null; now: Date }) {
  return (
    <p className="home-status">
      {freshness?.lastRunAt && (
        <span>
          Sweep ran {whenLabel(freshness.lastRunAt, now)} · {freshness.openCandidates} finds waiting
          to be checked ·
        </span>
      )}
      <Link href="/data/quality" className="fresh-footer">
        Data quality →
      </Link>
    </p>
  );
}
