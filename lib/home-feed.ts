/**
 * The front page's "what changed": checked events and the newest sweep finds
 * in one list, each saying which it is.
 *
 * Checked events alone went stale on the front page: an event is filed only
 * after a person reads it, and on 2026-10-01 the newest was 17 days old while
 * the sweep had found something every day. A page that asks "what is
 * changing" cannot answer with September. So the newest finds are shown
 * too, under the checked events and labelled unchecked — only those whose
 * headline names the bottleneck AND reports a change (lib/lead-signal.ts),
 * and never a page whose URL dates it before the window.
 */
import { EVENTS, eventsSince } from '@/config/substrata-events';
import { buildFeed, type DeskItem } from '@/lib/desk';
import { dateInUrl, reportsAChange } from '@/lib/lead-signal';
import { isOffTopic } from '@/lib/sweep';
import { freshness, recentLeads, type Freshness } from '@/lib/sweep-queue';

export const HOME_EVENT_DAYS = 30;
export const HOME_LEAD_DAYS = 14;
export const HOME_CHECKED = 5;
export const HOME_FOUND = 4;

export interface HomeFeed {
  /** Read by a person and filed, newest first. */
  checked: DeskItem[];
  /** Found by the sweep, unread, and reporting a change (lib/lead-signal.ts). */
  found: DeskItem[];
  /** False when the sweep's store could not be read: `found` is empty for that reason. */
  leadsRead: boolean;
  freshness: Freshness | null;
}

/**
 * The sweep's newest finds that report a change: unread, labelled unchecked,
 * never a page already filed as an event or dated before the window. Shared
 * by the front page and /events, so the two cannot disagree on what counts.
 */
export async function recentFinds(
  now: Date = new Date(),
  { days = HOME_LEAD_DAYS, limit = HOME_FOUND }: { days?: number; limit?: number } = {},
): Promise<Pick<HomeFeed, 'found' | 'leadsRead' | 'freshness'>> {
  const [leads, fresh] = await Promise.all([
    recentLeads(days).catch(() => null),
    freshness().catch(() => null),
  ]);
  const cutoff = new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
  const news = (leads ?? []).filter((lead) => {
    const written = dateInUrl(lead.url);
    return (
      reportsAChange(lead.title, lead.url) &&
      !isOffTopic(lead.bottleneck, lead.title) &&
      (written === null || written >= cutoff)
    );
  });
  const filed = new Set(EVENTS.map((event) => event.source));
  return {
    found: buildFeed([], news, now, days, true)
      .filter((item) => !filed.has(item.url))
      .slice(0, limit),
    leadsRead: leads !== null,
    freshness: fresh,
  };
}

export async function homeFeed(now: Date = new Date()): Promise<HomeFeed> {
  const events = eventsSince(HOME_EVENT_DAYS, now);
  return {
    checked: buildFeed(events, [], now).slice(0, HOME_CHECKED),
    ...(await recentFinds(now)),
  };
}
