import {
  EVENTS,
  EVENT_WORKLIST,
  candidatesAwaiting,
  eventsNewestFirst,
} from '@/config/substrata-events';
import { slugOf } from '@/lib/bottlenecks';

/**
 * Accepted events, newest first, plus how many candidates the sweep has
 * filed that nobody has read yet. Candidates themselves are not served:
 * they are a worklist, not a finding.
 */
export function GET() {
  return Response.json(
    {
      generatedAt: new Date().toISOString(),
      notice:
        'Accepted events only. Each names the bottlenecks it bears on and whether it tightens or loosens them. ' +
        'Candidates found by the sweep are counted, not listed, until an analyst accepts them.',
      accepted: EVENTS.length,
      candidatesAwaitingReview: candidatesAwaiting(),
      sweepRanAt: EVENT_WORKLIST.generatedAt,
      events: eventsNewestFirst().map((event) => ({
        ...event,
        bottleneckSlugs: event.bottlenecks.map(slugOf),
      })),
    },
    { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' } },
  );
}
