/**
 * The universe as a directory: one row per admitted company, filtered by tier,
 * theme, country and page kind through listkit, and searched through
 * @bitbaum/searchkit (never a ranker of ours). Pure over the entries; the page
 * passes the query in.
 */
import type { SearchSpec } from '@bitbaum/searchkit';
import { applyQuery, parseQuery, type ListQuery, type ListSpec } from 'listkit';

import { THEMES, themeById, type ThemeId } from '@/config/universe-themes';
import { textFilter } from '@/lib/text-filter';
import { PAGE_KINDS, pageKindOf, type PageKind } from './page-kinds';
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

/** Rows drawn at once: a phone paints these without scrolling through a thousand. */
export const DIRECTORY_PAGE = 60;
/** The most rows "Show more" will ever draw. */
export const DIRECTORY_MAX = 2000;

/**
 * The directory's filters as a listkit spec: a theme, a country, a tier and a
 * page kind, each one value. Countries are the ones on the list, so a code no
 * row carries filters nothing. Rows keep `directoryRows`' order (by name).
 */
export function directorySpec(rows: readonly DirectoryRow[]): ListSpec<DirectoryRow> {
  const countries = [...new Set(rows.flatMap((r) => (r.country ? [r.country] : [])))];
  return {
    facets: [
      { key: 'theme', kind: 'one', value: (r) => r.themes, options: THEMES.map((t) => t.id) },
      { key: 'country', kind: 'one', value: (r) => r.country, options: countries },
      { key: 'tier', kind: 'one', value: (r) => r.tier, options: ['A', 'B'] },
      { key: 'kind', kind: 'one', value: (r) => r.kind, options: PAGE_KINDS.map((k) => k.kind) },
    ],
    sorts: [{ key: 'name', by: [] }],
    defaultSort: 'name',
    defaultPageSize: DIRECTORY_PAGE,
  };
}

type Params = Record<string, string | string[] | undefined>;

/**
 * The URL as a query. Typed words are read whole (a comma is part of what was
 * typed, not a list) and capped at 80 characters; searchkit matches them.
 */
export function parseDirectory(params: Params, spec: ListSpec<DirectoryRow>): ListQuery {
  const typed = Array.isArray(params.q) ? params.q[0] : params.q;
  return {
    ...parseQuery(params, spec, { maxPageSize: DIRECTORY_MAX }),
    q: (typed ?? '').trim().slice(0, 80),
  };
}

export interface DirectoryResult {
  /** The rows drawn: the first `query.pageSize` that match. */
  rows: DirectoryRow[];
  /** Matching every filter and the typed words. */
  matched: number;
  /** All admitted companies. */
  total: number;
  /** Per facet and option, how many rows match everything BUT that facet's own selection. */
  counts: Record<string, Record<string, number>>;
}

/**
 * Typed words through searchkit (a slip forgiven), then the facets, their
 * counts and the rows drawn through listkit's `applyQuery`.
 */
export function queryDirectory(
  rows: readonly DirectoryRow[],
  spec: ListSpec<DirectoryRow>,
  query: ListQuery,
): DirectoryResult {
  const typed = textFilter(rows, DIRECTORY_SEARCH, query.q);
  const result = applyQuery(rows.filter(typed), spec, { ...query, q: '' });
  return { rows: result.rows, matched: result.matched, total: rows.length, counts: result.counts };
}
