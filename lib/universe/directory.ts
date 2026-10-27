/**
 * The universe as a directory: one row per admitted company, filtered by tier,
 * theme and country, and searched through @bitbaum/searchkit (never a ranker
 * of ours). Pure over the entries; the page passes the query in.
 */
import { createSearch, type SearchSpec } from '@bitbaum/searchkit';

import { themeById, type ThemeId } from '@/config/universe-themes';
import { pageKindOf, type PageKind } from './page-kinds';
import type { Tier, UniverseEntry } from './types';

export interface DirectoryRow {
  slug: string;
  name: string;
  tier: Tier;
  themes: ThemeId[];
  themeLabels: string[];
  country?: string;
  ticker?: string;
  venue?: string;
  kind: PageKind;
  aliases: string[];
}

export function directoryRows(entries: readonly UniverseEntry[]): DirectoryRow[] {
  return entries
    .filter((e) => e.admitted)
    .map((e) => ({
      slug: e.slug,
      name: e.name,
      tier: e.tier!,
      themes: e.themes,
      themeLabels: e.themes.map((t) => themeById(t)?.label ?? t),
      country: e.country,
      ticker: e.ids.ticker,
      venue: e.ids.exchange,
      kind: pageKindOf(e),
      aliases: e.aliases,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** What a typed word is matched against: the name first, then its aliases, ticker and country. */
export const DIRECTORY_SEARCH: SearchSpec<DirectoryRow> = {
  fields: [
    { name: 'name', get: (r) => r.name },
    { name: 'alias', get: (r) => r.aliases.join(' ') },
    { name: 'ticker', get: (r) => r.ticker },
    { name: 'country', get: (r) => r.country },
    { name: 'theme', get: (r) => r.themeLabels.join(' ') },
  ],
};

export interface DirectoryQuery {
  q: string;
  tier: '' | Tier;
  theme: '' | ThemeId;
  country: string;
  kind: '' | PageKind;
}

export interface DirectoryResult {
  rows: DirectoryRow[];
  /** Matching every filter and the typed words. */
  matched: number;
  /** All admitted companies. */
  total: number;
  /** Per option, how many rows match everything BUT that facet's own selection. */
  counts: {
    tier: Record<string, number>;
    theme: Record<string, number>;
    country: Record<string, number>;
    kind: Record<string, number>;
  };
}

const pass = (r: DirectoryRow, q: DirectoryQuery, skip?: keyof Omit<DirectoryQuery, 'q'>) =>
  (skip === 'tier' || !q.tier || r.tier === q.tier) &&
  (skip === 'theme' || !q.theme || r.themes.includes(q.theme)) &&
  (skip === 'country' || !q.country || r.country === q.country) &&
  (skip === 'kind' || !q.kind || r.kind === q.kind);

export function queryDirectory(rows: readonly DirectoryRow[], q: DirectoryQuery): DirectoryResult {
  const typed = q.q.trim();
  const found = typed
    ? new Set(
        createSearch(rows, DIRECTORY_SEARCH)
          .search(typed, { relax: false })
          .map((h) => h.item),
      )
    : null;
  const inText = (r: DirectoryRow) => !found || found.has(r);
  const matching = rows.filter((r) => inText(r) && pass(r, q));
  const count = (skip: keyof Omit<DirectoryQuery, 'q'>, key: (r: DirectoryRow) => string[]) => {
    const out: Record<string, number> = {};
    for (const r of rows)
      if (inText(r) && pass(r, q, skip)) for (const k of key(r)) out[k] = (out[k] ?? 0) + 1;
    return out;
  };
  return {
    rows: matching,
    matched: matching.length,
    total: rows.length,
    counts: {
      tier: count('tier', (r) => [r.tier]),
      theme: count('theme', (r) => r.themes),
      country: count('country', (r) => (r.country ? [r.country] : [])),
      kind: count('kind', (r) => [r.kind]),
    },
  };
}
