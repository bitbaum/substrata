import type { Metadata } from 'next';

import { COMPANY } from '@/config/substrata';
import { eventsNewestFirst, eventsSince } from '@/config/substrata-events';
import { instrumentsNewestFirst, policyTotals } from '@/config/substrata-policy';
import { BOTTLENECKS, portalTotals } from '@/lib/bottlenecks';
import { marketTotals } from '@/lib/participants';
import { Page, Shell } from '@/components/portal/Shell';
import { HomeHero } from './_home/HomeHero';
import { HomeStats } from './_home/HomeStats';
import { LatestRule } from './_home/LatestRule';
import { StartHere } from './_home/StartHere';
import { WINDOW_DAYS, WhatChanged } from './_home/WhatChanged';
import { WorstNow } from './_home/WorstNow';

export const metadata: Metadata = {
  title: { absolute: `${COMPANY.name} — the bottlenecks between here and much faster technology` },
  description:
    'What is holding back compute, energy, materials and robots: what each constraint is, who makes it, which rules govern it and what would remove it.',
};

/**
 * Today: what moved, and the four ways into the rest of the site.
 *
 * The front page answers three questions in order — what changed, what is
 * worst right now, and where do I start — and nothing else. Everything below
 * the fold is a route into a section rather than an essay.
 */
export default function TodayPage() {
  const totals = portalTotals();
  const markets = marketTotals();
  const policy = policyTotals();
  const recent = eventsSince(WINDOW_DAYS);
  const tightening = new Set(
    recent.filter((e) => e.effect === 'tightens').flatMap((e) => e.bottlenecks),
  );
  const loosening = new Set(
    recent.filter((e) => e.effect === 'loosens').flatMap((e) => e.bottlenecks),
  );
  const worst = [...BOTTLENECKS]
    .filter((b) => b.horizon === 'now')
    .sort((a, b) => b.binding - a.binding)
    .slice(0, 8);
  const latestEvent = eventsNewestFirst()[0];
  const latestRule = instrumentsNewestFirst()[0];
  const featured =
    worst.find((b) => b.producers.length > 0) ?? BOTTLENECKS.find((b) => b.producers.length > 0);

  return (
    <Shell currentPath="">
      <Page>
        <HomeHero newest={latestEvent ? latestEvent.date : latestRule?.date} featured={featured} />

        <HomeStats totals={totals} markets={markets} policy={policy} />

        <div className="grid gap-12 lg:grid-cols-[3fr_2fr]">
          <div>
            <WhatChanged recent={recent} />
            <WorstNow
              worst={worst}
              bindingNow={totals.bindingNow}
              tightening={tightening}
              loosening={loosening}
            />
          </div>

          <div>
            <StartHere />
            <LatestRule latestRule={latestRule} />
          </div>
        </div>
      </Page>
    </Shell>
  );
}
