import type { Metadata } from 'next';

import { COMPANY } from '@/config/substrata';
import { eventsNewestFirst, eventsSince } from '@/config/substrata-events';
import { instrumentsNewestFirst, policyTotals } from '@/config/substrata-policy';
import { BOTTLENECKS, portalTotals } from '@/lib/bottlenecks';
import { marketTotals } from '@/lib/participants';
import { WINDOW_DAYS, worstNow } from '@/lib/worst-now';
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
export default function TodayPage() {
  const totals = portalTotals();
  const board = worstNow(8);
  const latestEvent = eventsNewestFirst()[0];
  const latestRule = instrumentsNewestFirst()[0];
  const featured =
    board.worst.find((b) => b.producers.length > 0) ??
    BOTTLENECKS.find((b) => b.producers.length > 0);

  return (
    <Shell currentPath="">
      <Page>
        <HomeHero newest={latestEvent ? latestEvent.date : latestRule?.date} featured={featured} />

        <ChooseRole />

        <div className="mb-14 grid gap-12 lg:grid-cols-[3fr_2fr]">
          <div>
            <WhatChanged recent={eventsSince(WINDOW_DAYS)} />
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
