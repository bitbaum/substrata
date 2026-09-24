/**
 * What a reader has done with the feed, and what is on screen because of it:
 * marks, views, filters and the per-rail activity count. The feed itself —
 * merging events and leads, cleaning titles — is `desk.ts`.
 */
import type { EventEffect } from '@/config/substrata-events';
import type { DeskItem } from '@/lib/desk';

export type MarkState = 'read' | 'saved' | 'hidden';

/** The key a mark is stored under. A lead and an event never share one. */
export function itemKey(item: Pick<DeskItem, 'source' | 'id'>): string {
  return `${item.source}:${item.id}`;
}

export const VIEWS = ['unread', 'all', 'saved', 'hidden'] as const;
export type View = (typeof VIEWS)[number];

export interface FeedFilter {
  view: View;
  /** Days back from now, or null for all time. */
  days: number | null;
  showVerified: boolean;
  showLeads: boolean;
  showFilings: boolean;
  /** Papers, preprints and grants from the science feeds. Absent means shown. */
  showScience?: boolean;
  effect: EventEffect | null;
  /** Bottleneck names; empty means every rail. */
  bottlenecks: string[];
  q: string;
  mutedHosts: readonly string[];
  mutedWords: readonly string[];
  readUntil: string | null;
}

export interface MarkSets {
  read: ReadonlySet<string>;
  saved: ReadonlySet<string>;
  hidden: ReadonlySet<string>;
}

export function isRead(item: DeskItem, marks: MarkSets, readUntil: string | null): boolean {
  return marks.read.has(itemKey(item)) || (readUntil !== null && item.at <= readUntil);
}

function muted(item: DeskItem, filter: FeedFilter): boolean {
  const host = item.host;
  if (
    host &&
    filter.mutedHosts.some(
      (m) =>
        host === m || host.endsWith(`.${m}`) || (item.source === 'lead' && item.alsoAt.includes(m)),
    )
  )
    return true;
  const title = item.title.toLowerCase();
  return filter.mutedWords.some((word) => title.includes(word.toLowerCase()));
}

/**
 * Every rule that decides whether a row is on screen, in one place.
 *
 * Order matters only for honesty: a hidden row is invisible in every view
 * except "hidden", so hiding is always undoable from the desk itself.
 */
export function applyFilter(
  feed: readonly DeskItem[],
  filter: FeedFilter,
  marks: MarkSets,
  now: Date = new Date(),
): DeskItem[] {
  const since = filter.days === null ? null : now.getTime() - filter.days * 86_400_000;
  const q = filter.q.trim().toLowerCase();
  return feed.filter((item) => {
    const key = itemKey(item);
    if (filter.view === 'hidden') return marks.hidden.has(key);
    if (marks.hidden.has(key)) return false;
    if (filter.view === 'saved') return marks.saved.has(key);
    if (filter.view === 'unread' && isRead(item, marks, filter.readUntil)) return false;
    const shown =
      item.source === 'event'
        ? filter.showVerified
        : item.source === 'lead'
          ? filter.showLeads
          : item.source === 'science'
            ? filter.showScience !== false
            : filter.showFilings;
    if (!shown) return false;
    if (since !== null && Date.parse(item.at) < since) return false;
    if (filter.effect && !(item.source === 'event' && item.effect === filter.effect)) return false;
    if (
      filter.bottlenecks.length > 0 &&
      !item.bottlenecks.some((b) => filter.bottlenecks.includes(b))
    )
      return false;
    if (q && !`${item.title} ${item.host} ${item.bottlenecks.join(' ')}`.toLowerCase().includes(q))
      return false;
    return !muted(item, filter);
  });
}

export interface RailActivity {
  name: string;
  count: number;
  latest: DeskItem;
}

/** Which rails moved: rows per bottleneck in the filtered feed, busiest first. */
export function railActivity(items: readonly DeskItem[]): RailActivity[] {
  const by = new Map<string, RailActivity>();
  for (const item of items) {
    for (const name of item.bottlenecks) {
      const seen = by.get(name);
      if (seen) seen.count += 1;
      else by.set(name, { name, count: 1, latest: item });
    }
  }
  return [...by.values()].sort(
    (a, b) => b.count - a.count || b.latest.at.localeCompare(a.latest.at),
  );
}
