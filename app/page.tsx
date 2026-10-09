import type { Metadata } from 'next';

import { COMPANY } from '@/config/substrata';
import { policyTotals } from '@/config/substrata-policy';
import { portalTotals } from '@/lib/bottlenecks';
import { homeFeed } from '@/lib/home-feed';
import { marketTotals } from '@/lib/participants';
import { worstNow } from '@/lib/worst-now';
import { Page, Shell } from '@/components/portal/Shell';
import { ChooseRole } from './_home/ChooseRole';
import { HomeFoot } from './_home/HomeFoot';
import { HomeHero } from './_home/HomeHero';
import { HomeStats } from './_home/HomeStats';
import { WhatChanged } from './_home/WhatChanged';
import { WorstNow } from './_home/WorstNow';

export const metadata: Metadata = {
  title: { absolute: `${COMPANY.name} — the bottlenecks between here and much faster technology` },
  description:
    'What is holding back compute, energy, materials and robots: what each constraint is, who makes it, which rules govern it and what would remove it.',
};

/**
 * The front page answers, in order: what is this (one line, one sentence,
 * one button), what is worst right now (three rows — the proof that the
 * map holds something), which door is mine, what changed (three checked
 * events), and how big the corpus is. Then one line for the reader who can
 * fix it, and how live the site is.
 *
 * That is five short sections. On 2026-10-09 the page measured 18,686px on
 * a phone — some twenty screens: a two-clause title and three-sentence lede,
 * five role cards, thirteen "what it solves" cards, eight worst rows, two
 * event lists, two clouds of technology and industry chips, the latest rule
 * and the counts. Every piece was true and the page still said nothing
 * first. What left it is still on the site: the problem cards' copy stays
 * in config/what-it-solves.ts for the role views, the chips are the
 * filters on /bottlenecks, the latest rule is the top of /policy, and
 * unchecked finds lead News.
 */
// The front page reads the sweep's store on every request: "what changed"
// is the one thing on it that must not be as old as the last deploy.
export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const now = new Date();
  const totals = portalTotals();
  const board = worstNow(3);
  const feed = await homeFeed(now);

  return (
    <Shell>
      <Page>
        <HomeHero />

        <div className="mb-12 grid gap-12 lg:grid-cols-[2fr_3fr]">
          <WorstNow {...board} bindingNow={totals.bindingNow} />
          <ChooseRole />
        </div>

        <WhatChanged feed={feed} now={now} compact />

        <HomeStats totals={totals} markets={marketTotals()} policy={policyTotals()} />

        <HomeFoot freshness={feed.freshness} now={now} />
      </Page>
    </Shell>
  );
}
