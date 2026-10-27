import type { Metadata } from 'next';

import { COMPANY } from '@/config/substrata';
import { policyTotals } from '@/config/substrata-policy';
import { portalTotals } from '@/lib/bottlenecks';
import { homeFeed } from '@/lib/home-feed';
import { homeMarkets } from '@/lib/home-markets';
import { homeAsks, seedFor } from '@/lib/starters';
import { worstNow } from '@/lib/worst-now';
import { Page, Shell } from '@/components/portal/Shell';
import { Doors } from './_home/Doors';
import { HomeHero } from './_home/HomeHero';
import { HomeMarkets } from './_home/HomeMarkets';
import { HomeNumbers } from './_home/HomeNumbers';
import { HomeStatus } from './_home/HomeStatus';
import { WhatChanged } from './_home/WhatChanged';
import { WorstNow } from './_home/WorstNow';

export const metadata: Metadata = {
  title: { absolute: `${COMPANY.name} — the bottlenecks between here and much faster technology` },
  description:
    'What is holding back compute, energy, materials and robots: what each constraint is, who makes it, which rules govern it and what would remove it.',
};

/**
 * The front page, in order: ask (the hero is the Ask box, the same box as
 * /chat), what is worst right now, what changed, the listed names on the
 * chain (only from stored closes), the corpus in four numbers, which door is
 * yours. Then a calm footer. Short sections; on 2026-10-09 the page measured 18,686px
 * on a phone and said nothing first, and the discipline is that it stays
 * short — what left it is still on the site (config/what-it-solves.ts for
 * the role views, the chips on /bottlenecks, the latest rule at the top of
 * /policy, unchecked finds on /events).
 *
 * It is served from a cache and rebuilt at most a minute after anyone asks:
 * "what changed" is the one thing on it that must not be as old as the last
 * deploy, and a minute is as fresh as the sweep itself can make it. For that
 * the page cannot read the session — the shell learns its reader from
 * /api/me in the browser (Shell reader="client"). Reading it here made every
 * request a render, measured at 640–850ms.
 */
export const revalidate = 60;
// Pinned, not just implied: with a session secret configured (production), the
// build treated this route as dynamic although nothing on the page reads a
// request — measured with AUTH_SECRET set, `next build` listed it as ƒ. Pinning
// it static means a stray session read returns "signed out" instead of
// silently making every visit a render again.
export const dynamic = 'force-static';

export default async function HomePage() {
  const now = new Date();
  const totals = portalTotals();
  const board = worstNow(3);
  const [feed, markets] = await Promise.all([homeFeed(now), homeMarkets()]);

  return (
    <Shell reader="client" status={<HomeStatus freshness={feed.freshness} now={now} />}>
      <Page>
        <div className="home-column">
          <HomeHero asks={homeAsks(seedFor(now))} />

          <div className="home-pair">
            <WorstNow {...board} bindingNow={totals.bindingNow} />
            <WhatChanged feed={feed} now={now} />
          </div>

          <HomeMarkets {...markets} />
          <HomeNumbers totals={totals} policy={policyTotals()} />
          <Doors />
        </div>
      </Page>
    </Shell>
  );
}
