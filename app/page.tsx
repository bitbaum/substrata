import type { Metadata } from 'next';

import { COMPANY } from '@/config/substrata';
import { instrumentsNewestFirst, policyTotals } from '@/config/substrata-policy';
import { portalTotals } from '@/lib/bottlenecks';
import { homeFeed } from '@/lib/home-feed';
import { marketTotals } from '@/lib/participants';
import { worstNow } from '@/lib/worst-now';
import { Page, Shell } from '@/components/portal/Shell';
import { ChooseRole } from './_home/ChooseRole';
import { HomeHero } from './_home/HomeHero';
import { HomeStats } from './_home/HomeStats';
import { LatestRule } from './_home/LatestRule';
import { StartHere } from './_home/StartHere';
import { WhatChanged } from './_home/WhatChanged';
import { WorstNow } from './_home/WorstNow';

export const metadata: Metadata = {
  title: { absolute: `${COMPANY.name} — the bottlenecks between here and much faster technology` },
  description:
    'What is holding back compute, energy, materials and robots: what each constraint is, who makes it, which rules govern it and what would remove it.',
};

/**
 * The front page answers, in order: what is this, which part of it is for
 * me, what changed, and what is worst right now. The reader's own door comes
 * straight after the hero because every audience — traders, industry teams,
 * job seekers, learners — needs a different slice, and making them find it
 * in a menu was the hierarchy fault. The corpus counts come last: they are
 * evidence for a reader already interested, not a way in.
 */
// The front page reads the sweep's store on every request: "what changed"
// is the one thing on it that must not be as old as the last deploy.
export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const now = new Date();
  const totals = portalTotals();
  const board = worstNow(8);
  const latestRule = instrumentsNewestFirst()[0];
  const feed = await homeFeed(now);

  return (
    <Shell>
      <Page>
        <HomeHero freshness={feed.freshness} now={now} />

        <ChooseRole />

        <div className="mb-14 grid gap-12 lg:grid-cols-[3fr_2fr]">
          <div>
            <WhatChanged feed={feed} now={now} />
          </div>
          <div>
            <WorstNow {...board} bindingNow={totals.bindingNow} />
          </div>
        </div>

        <div className="mb-14 grid gap-12 lg:grid-cols-[3fr_2fr]">
          <StartHere />
          <LatestRule latestRule={latestRule} />
        </div>

        <HomeStats totals={totals} markets={marketTotals()} policy={policyTotals()} />
      </Page>
    </Shell>
  );
}
