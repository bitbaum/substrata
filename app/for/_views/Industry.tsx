import { eventsNewestFirst } from '@/config/substrata-events';
import { portalTotals } from '@/lib/bottlenecks';
import { byRelevance } from '@/lib/series';
import { allSeries } from '@/lib/series-store';
import { newItems, type StoredItem } from '@/lib/science-read';
import { worstNow } from '@/lib/worst-now';
import type { FreshnessReport } from '@/lib/freshness/read';
import { EventList } from '@/components/portal/EventList';
import { ItemList } from '@/components/science/ItemList';
import { FeedStatus } from '@/components/roles/RoleParts';
import { RoleSection } from '@/components/roles/RoleSection';
import { SeriesRows } from '@/components/roles/SeriesRows';
import { WorstNow } from '../../_home/WorstNow';

const LEAD_KINDS = new Set(['lead-time', 'backlog', 'queue', 'orders']);

/** For planners: how hard each constraint binds, how long the queue is, and what could end it. */
export async function IndustryView({ report }: { report: FreshnessReport }) {
  const board = worstNow(8);
  const { series } = await allSeries();
  const leads = series
    .filter((s) => LEAD_KINDS.has(s.kind))
    .sort(byRelevance)
    .slice(0, 8);
  let science: StoredItem[] | null = null;
  try {
    science = await newItems(null, 6);
  } catch {
    science = null;
  }
  const feed = (id: string) => report.feeds.find((f) => f.feed.id === id);

  return (
    <div className="role-grid">
      <RoleSection
        index="01"
        title="The bottleneck board"
        why="The constraints judged to bind hardest right now, and which of them an event this month moved."
        href="/bottlenecks"
        more="Every bottleneck, filterable by technology and stage"
      >
        <WorstNow {...board} bindingNow={portalTotals().bindingNow} bare />
      </RoleSection>
      <RoleSection
        index="02"
        title="Lead times, backlogs and queues"
        why="How long an order waits: the dated, sourced numbers behind each ‘years-long’ claim."
        href="/data/series?kind=lead-time"
        more="Every series, with charts and CSV"
      >
        <SeriesRows series={leads} />
      </RoleSection>
      <RoleSection
        index="03"
        title="What changed"
        why="Capacity, outages, rules and milestones on the bottlenecks, newest first, each with its source."
        href="/events"
        more="Every event"
      >
        <EventList events={eventsNewestFirst().slice(0, 5)} />
      </RoleSection>
      <RoleSection
        index="04"
        title="What could relieve them"
        why="Papers, preprints and grants collected this week against each bottleneck — unreviewed, sorted by stage on the pipeline."
        href="/science/pipeline"
        more="The science pipeline, by stage"
        status={<FeedStatus row={feed('science')} />}
      >
        {science === null ? (
          <p className="role-empty">The science feed could not be read just now.</p>
        ) : science.length === 0 ? (
          <p className="role-empty">Nothing new collected this week yet.</p>
        ) : (
          <ItemList items={science} showBottleneck />
        )}
      </RoleSection>
    </div>
  );
}
