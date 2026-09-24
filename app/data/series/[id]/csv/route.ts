import { allSeries } from '@/lib/series-store';
import { seriesById, seriesCsv } from '@/lib/series';

export const dynamic = 'force-dynamic';

/** One series as CSV: every point with its period, value, source and quote. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const series = seriesById((await allSeries()).series, id);
  if (!series) return new Response('No such series.', { status: 404 });
  return new Response(seriesCsv(series), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="substrata-${series.id}.csv"`,
    },
  });
}
