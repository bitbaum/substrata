/**
 * The desk's URL, parsed. The URL wins; the reader's saved defaults fill the
 * rest. Pure, so the page and its links cannot disagree about what a
 * parameter means.
 */
import type { EventEffect } from '@/config/substrata-events';
import type { Bottleneck } from '@/lib/bottlenecks';
import { VIEWS, type FeedFilter, type View } from '@/lib/desk-filter';
import { WINDOWS, type DeskSettings, type Grouping, type Window } from '@/lib/follows';

export type Params = Record<string, string | undefined>;

export const SOURCES = ['all', 'verified', 'leads'] as const;
export type Sources = (typeof SOURCES)[number];
export const SOURCE_LABEL: Record<Sources, string> = {
  all: 'Verified events + web leads',
  verified: 'Verified events only',
  leads: 'Web leads only',
};

export const VIEW_LABEL: Record<View, string> = {
  unread: 'Unread',
  all: 'All',
  saved: 'Saved',
  hidden: 'Hidden',
};

/** The parameters a filter link carries forward. Paging (`n`) deliberately is not one. */
const KEPT = ['view', 'w', 'src', 'fx', 'rail', 'q', 'g'] as const;

export interface DeskQuery {
  view: View;
  window: Window;
  sources: Sources;
  effect: EventEffect | null;
  rail: Bottleneck | undefined;
  q: string;
  grouping: Grouping;
  /** True when anything beyond the view narrows the feed. */
  filtered: boolean;
  base: Omit<FeedFilter, 'view'>;
  href: (next: Params) => string;
}

export function parseDeskQuery(
  params: Params,
  settings: DeskSettings,
  rails: readonly Bottleneck[],
): DeskQuery {
  const view: View = VIEWS.includes(params.view as View) ? (params.view as View) : 'unread';
  const window: Window = WINDOWS.includes(params.w as Window)
    ? (params.w as Window)
    : settings.window;
  const fallback: Sources =
    settings.showVerified && !settings.showLeads
      ? 'verified'
      : !settings.showVerified && settings.showLeads
        ? 'leads'
        : 'all';
  const sources: Sources = SOURCES.includes(params.src as Sources)
    ? (params.src as Sources)
    : fallback;
  const effect: EventEffect | null =
    params.fx === 'tightens' || params.fx === 'loosens' ? params.fx : null;
  const rail = rails.find((b) => b.slug === params.rail);
  const q = (params.q ?? '').slice(0, 120);
  const grouping: Grouping =
    params.g === 'bottleneck' || params.g === 'day' ? params.g : settings.grouping;

  const href = (next: Params) => {
    const merged: Params = { ...Object.fromEntries(KEPT.map((k) => [k, params[k]])), ...next };
    const qs = new URLSearchParams(
      Object.entries(merged).filter((entry): entry is [string, string] => Boolean(entry[1])),
    ).toString();
    return qs ? `/account?${qs}` : '/account';
  };

  return {
    view,
    window,
    sources,
    effect,
    rail,
    q,
    grouping,
    filtered: Boolean(params.w || params.src || params.fx || params.rail || params.q),
    base: {
      days: window === 'all' ? null : Number(window),
      showVerified: sources !== 'leads',
      showLeads: sources !== 'verified',
      effect,
      bottlenecks: rail ? [rail.name] : [],
      q,
      mutedHosts: settings.mutedHosts,
      mutedWords: settings.mutedWords,
      readUntil: settings.readUntil,
    },
    href,
  };
}
