import Link from 'next/link';

import { WHAT_IT_SOLVES } from '@/config/what-it-solves';
import { whenLabel } from '@/lib/desk';
import type { Freshness } from '@/lib/sweep-queue';

/**
 * The front page's last lines: how live the site is, and the way in for
 * someone who knows better than it does.
 *
 * The status says whether anyone is still looking — when the sweep last ran
 * and how much it holds unchecked — never a record date dressed as freshness
 * (test/sweep.test.ts). Both numbers link to the page that measures them.
 */
export function HomeFoot({ freshness, now }: { freshness: Freshness | null; now: Date }) {
  return (
    <footer className="home-foot">
      <p className="home-foot-fix">
        {WHAT_IT_SOLVES.cta.lede}{' '}
        <Link href={WHAT_IT_SOLVES.cta.primary.href}>{WHAT_IT_SOLVES.cta.primary.label} →</Link>
      </p>
      <p className="home-hero-status">
        {freshness?.lastRunAt ? (
          <>
            <span className="home-hero-live" aria-hidden />
            Sweep ran {whenLabel(freshness.lastRunAt, now)} · {freshness.openCandidates} finds
            waiting to be checked ·{' '}
          </>
        ) : null}
        <Link href="/data/freshness">How fresh is this?</Link>
      </p>
    </footer>
  );
}
