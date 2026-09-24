import { isSearchType, search } from '@/lib/search';

/**
 * Instant results for the search box: the top hits, grouped by type, with
 * per-type counts. The index is static config built once per process, so this
 * is a pure function of the query and safe to cache briefly at the edge.
 */
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = (params.get('q') ?? '').slice(0, 200);
  const type = params.get('type');
  const result = search(q, {
    type: isSearchType(type) ? type : null,
    limit: 8,
    perGroup: 3,
  });
  return Response.json(result, {
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=600' },
  });
}
