import Link from 'next/link';

import { whenLabel } from '@/lib/desk';
import type { Freshness } from '@/lib/sweep-queue';

/**
 * The front page's opening: what the site is, and how live it is right now.
 *
 * The status line used to read "Newest record 2026-09-14" — true, and on
 * 2026-10-01 it told every reader the site had stopped. What a reader needs
 * is whether anyone is still looking: when the sweep last ran, and how much
 * it is holding that nobody has checked yet. Both link to the page that
 * measures them.
 */
export function HomeHero({ freshness, now }: { freshness: Freshness | null; now: Date }) {
  return (
    <header className="home-hero">
      <p className="home-hero-status">
        {freshness?.lastRunAt ? (
          <>
            <span className="home-hero-live" aria-hidden />
            Sweep ran {whenLabel(freshness.lastRunAt, now)} · {freshness.openCandidates} finds
            waiting to be checked ·{' '}
          </>
        ) : null}
        <Link href="/data/freshness" className="link-target">
          How fresh is this?
        </Link>
      </p>
      <h1 className="home-hero-title">What is holding technology back, and what is changing.</h1>
      <p className="home-hero-lede">
        Substrata maps the constraints on building more compute, more power, better materials and
        better machines. Every row says how well it is evidenced, every sourced claim links to its
        source, and every number opens to show where it came from.
      </p>
      <div className="home-hero-actions">
        <Link href="/atlas" className="research-button">
          Open the map
        </Link>
        <Link href="/chat" className="research-button-ghost">
          Ask
        </Link>
      </div>
    </header>
  );
}
