/**
 * Events accepted at /review reach the site at once, without a commit.
 *
 * Until 2026-10-01 accepting a lead parked it in the database, and it reached a
 * page only after someone ran `research:accept-events`, committed the file and
 * deployed. Nobody did, for 17 days, while the front page asked "what is
 * changing". The reviewer's decision is the judgement; the commit was clerical.
 *
 * So every render merges the accepted rows into EVENTS — the one list every
 * reader goes through — and refreshes the two tables that copied events at
 * startup (bottlenecks, companies), so no page disagrees with another. A row
 * is merged only if it passes the same rules /review applied, and never twice
 * (by id or by source). The git file still catches up through the script;
 * once it does, the row is simply already there.
 */
import {
  EVENTS,
  eventsFor,
  eventsNewestFirst,
  type CoverageEvent,
} from '@/config/substrata-events';
import { BOTTLENECKS } from '@/lib/bottlenecks';
import { acceptedEvents } from '@/lib/event-draft-store';
import { eventProblems } from '@/lib/event-rules';
import { MARKET_PARTICIPANTS } from '@/lib/participants';

/** How stale the merge may be. Accepting at /review forces a fresh one. */
export const EVENTS_SYNC_SECONDS = 60;

let lastSync = 0;
let inFlight: Promise<number> | null = null;

/** Add the rows not yet in `list`; returns how many were added. Pure apart from `list`. */
export function mergeAccepted(list: CoverageEvent[], rows: readonly CoverageEvent[]): number {
  const ids = new Set(list.map((e) => e.id));
  const sources = new Set(list.map((e) => e.source));
  let added = 0;
  for (const row of rows) {
    if (ids.has(row.id) || sources.has(row.source)) continue;
    if (eventProblems(row).length > 0) continue;
    list.push(row);
    ids.add(row.id);
    sources.add(row.source);
    added += 1;
  }
  return added;
}

/** Re-derive the per-bottleneck and per-company event lists from EVENTS. */
function refreshDerived(): void {
  for (const b of BOTTLENECKS) b.events = eventsFor(b.name);
  const newest = eventsNewestFirst();
  for (const p of MARKET_PARTICIPANTS) {
    p.events = newest.filter((event) => event.participants.includes(p.name));
  }
}

/**
 * Merge events accepted at /review into EVENTS. Cheap to call on every
 * request: it reads the database at most once per EVENTS_SYNC_SECONDS, and
 * never throws — without a database (a build, a test) the site is the file.
 */
export async function syncAcceptedEvents({
  force = false,
  load = acceptedEvents,
}: { force?: boolean; load?: () => Promise<CoverageEvent[]> } = {}): Promise<number> {
  if (!force && Date.now() - lastSync < EVENTS_SYNC_SECONDS * 1000) return 0;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const rows = await load();
      const added = mergeAccepted(EVENTS as CoverageEvent[], rows);
      if (added > 0) refreshDerived();
      return added;
    } catch {
      return 0;
    } finally {
      lastSync = Date.now();
      inFlight = null;
    }
  })();
  return inFlight;
}
