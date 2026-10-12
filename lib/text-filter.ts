/**
 * A table's filter-by-typing box: the rows the typed words find, a slip
 * forgiven ("wolfsped" is still Wolfspeed), leaving the table's own order —
 * a sort the reader chose, newest first — alone. Matching is
 * `@bitbaum/searchkit`'s, the same rules as the site search and ⌘K.
 *
 * A filter narrows: every typed word must match (no word is set aside, as the
 * search box does), so a second word never quietly widens the table.
 */
import { createSearch, type SearchSpec } from '@bitbaum/searchkit';

export function textFilter<T>(
  rows: readonly T[],
  spec: SearchSpec<T>,
  query: string,
): (row: T) => boolean {
  if (!query.trim()) return () => true;
  const found = new Set(
    createSearch(rows, spec)
      .search(query, { relax: false })
      .map((h) => h.item),
  );
  return (row) => found.has(row);
}
