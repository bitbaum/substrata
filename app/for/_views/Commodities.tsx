import { eventsNewestFirst } from '@/config/substrata-events';
import { instrumentsNewestFirst } from '@/config/substrata-policy';
import { allSeries } from '@/lib/series-store';
import type { FreshnessReport } from '@/lib/freshness/read';
import { EventList } from '@/components/portal/EventList';
import { FeedStatus, Rows } from '@/components/roles/RoleParts';
import { RoleSection } from '@/components/roles/RoleSection';
import { SeriesRows, biggestMoves } from '@/components/roles/SeriesRows';
import { policyHref } from '@/lib/links';
import { ScenarioLinks } from './ScenarioLinks';

/** Prices, volumes and output first; then the rules that move them. */
export async function CommoditiesView({ report }: { report: FreshnessReport }) {
  const { series, officialOk } = await allSeries();
  const moves = biggestMoves(
    series,
    ['price', 'price-index', 'output', 'trade', 'inventory', 'capacity'],
    10,
  );
  const controls = eventsNewestFirst()
    .filter((e) => e.kind === 'policy')
    .slice(0, 5);
  const rules = instrumentsNewestFirst()
    .slice(0, 5)
    .map((i) => ({
      key: i.id,
      title: i.title,
      href: policyHref(i.jurisdiction),
      meta: `${i.date} · ${i.body}`,
    }));
  const feed = report.feeds.find((f) => f.feed.id === 'series');

  return (
    <div className="role-grid">
      <RoleSection
        index="01"
        title="Biggest moves"
        why="Prices, output, trade volumes and capacity whose latest actual value moved most against the point before, within the last year."
        href="/data/series"
        more="Every series, with charts and CSV"
        status={
          <>
            <FeedStatus row={feed} verb="fetched" />
            {!officialOk && ' · official statistics could not be read just now'}
          </>
        }
        wide
      >
        <SeriesRows series={moves} />
      </RoleSection>
      <RoleSection
        index="02"
        title="Export controls and trade rules"
        why="Recorded policy events, newest first: what tightened or loosened supply, dated and sourced."
        href="/events"
        more="Every event"
      >
        <EventList events={controls} />
      </RoleSection>
      <RoleSection
        index="03"
        title="Rules tracked"
        why="The newest instruments that speed up or slow down building, by the body that issued them."
        href="/policy"
        more="Every rule, and who asked for it"
      >
        <Rows rows={rules} empty="No rules tracked yet." />
      </RoleSection>
      <RoleSection
        index="04"
        title="What if supply stops?"
        why="Scenarios from the record: an export halt or an outage, traced to the bottlenecks and companies it reaches."
        href="/scenarios"
        more="Build any scenario"
        wide
      >
        <ScenarioLinks />
      </RoleSection>
    </div>
  );
}
