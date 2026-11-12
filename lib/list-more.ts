/**
 * "Show more" on a server-rendered list: the reader's `?n=` says how many rows
 * are drawn, and the link to the next batch is listkit's `writeQuery` over the
 * params the reader arrived with, so a search or a filter survives the click
 * and a value the list does not accept is not written back.
 *
 * `n` (rows drawn so far), not listkit's `page`/`size`: a phone keeps what it
 * has already scrolled past, and links shared before listkit keep working.
 */
import { writeQuery, type ListQuery, type ListSpec } from 'listkit';

type Params = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Rows to draw: `?n=`, never fewer than one batch, never more than `max`. */
export function rowsShown(params: Params, step: number, max: number): number {
  return Math.min(Math.max(Number(first(params.n)) || step, step), max);
}

/** The query for the first `shown` rows: one page as tall as everything drawn. */
export function shownQuery(query: ListQuery, shown: number): ListQuery {
  return { ...query, page: 1, pageSize: shown };
}

/** The href that draws `step` more rows, keeping every other param. */
export function moreHref<T>(
  path: string,
  params: Params,
  query: ListQuery,
  spec: ListSpec<T>,
  step: number,
): string {
  const next = writeQuery(
    params,
    { ...query, page: 1, pageSize: spec.defaultPageSize ?? 25 },
    spec,
  );
  next.set('n', String(query.pageSize + step));
  return `${path}?${next}`;
}
