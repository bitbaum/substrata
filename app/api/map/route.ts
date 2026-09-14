import { buildMap } from '@/lib/map';

/**
 * The whole map as one JSON document. Built from the same config the pages
 * render, so it cannot disagree with the site — see lib/map.ts.
 */
export function GET() {
  return Response.json(buildMap(), {
    headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' },
  });
}
