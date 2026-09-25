import { EVENTS, eventsNewestFirst } from '@/config/substrata-events';
import { slugOf } from '@/lib/bottlenecks';
import { freshness } from '@/lib/sweep-queue';

// The sweep's state is read from its queue on every request (behind the
// five-minute cache header), never baked in at build time, when there is no
// database and the answer would be a fallback frozen into the release.
export const dynamic = 'force-dynamic';

/**
 * Accepted events, newest first, plus when the sweep last ran and how many
 * leads it has filed that nobody has read yet. Leads themselves are not
 * served: they are a worklist, not a finding.
 *
 * The sweep figures come from the one queue the box timer fills,
 * `research_sweep_candidates` (`lib/sweep-queue.ts`). When the database cannot
 * be read they are null and `sweep.readable` says so — "we cannot tell you"
 * is never reported as "the sweep has not run" or "nothing is waiting".
 */
export async function GET() {
  const sweep = await freshness().catch(() => null);
  return Response.json(
    {
      generatedAt: new Date().toISOString(),
      notice:
        'Accepted events only. Each names the bottlenecks it bears on and whether it tightens or loosens them. ' +
        'Leads found by the sweep are counted, not listed, until a person accepts them.',
      accepted: EVENTS.length,
      candidatesAwaitingReview: sweep?.openCandidates ?? null,
      sweepRanAt: sweep?.lastRunAt ?? null,
      sweep: sweep
        ? {
            readable: true,
            lastRunAt: sweep.lastRunAt,
            openCandidates: sweep.openCandidates,
            nodesCovered: sweep.nodesCovered,
            nodesTotal: sweep.nodesTotal,
            blind: sweep.blind,
          }
        : {
            readable: false,
            reason:
              'The sweep queue could not be read just now; this is not a report that it has not run.',
          },
      events: eventsNewestFirst().map((event) => ({
        ...event,
        bottleneckSlugs: event.bottlenecks.map(slugOf),
      })),
    },
    { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' } },
  );
}
