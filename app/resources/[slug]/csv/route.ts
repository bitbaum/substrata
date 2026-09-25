import { rankingCsv, resourceRanking } from '@/lib/resources/ranking';
import { resourcesWithData } from '@/lib/resources/usgs';

export function generateStaticParams(): Array<{ slug: string }> {
  return resourcesWithData().map((slug) => ({ slug }));
}

/** The world ranking on /resources/[slug], as CSV. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ranking = resourceRanking(slug);
  if (!ranking) return new Response('No table for this resource.\n', { status: 404 });
  return new Response(rankingCsv(ranking), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="substrata-${slug}-${ranking.production.year}.csv"`,
    },
  });
}
