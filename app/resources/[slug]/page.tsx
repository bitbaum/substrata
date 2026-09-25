import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Page, Shell, SectionHeader } from '@/components/portal/Shell';
import { Figure } from '@/components/portal/Figure';
import { RankingTable } from '@/components/portal/resources/RankingTable';
import { RestrictionsByCountry } from '@/components/portal/resources/RestrictionsByCountry';
import { resourceLabel } from '@/config/substrata-resources';
import { resourceRanking } from '@/lib/resources/ranking';
import { chapterFor, resourcesWithData } from '@/lib/resources/usgs';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return resourcesWithData().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const chapter = chapterFor(slug);
  return chapter
    ? {
        title: `${resourceLabel(slug)}: world producers and reserves`,
        description: `Who produces ${chapter.commodity.toLowerCase()}, who holds reserves, how concentrated it is, and what exporters restrict. ${chapter.source}, ${chapter.edition}.`,
      }
    : {};
}

export default async function ResourcePage({ params }: RouteParams) {
  const { slug } = await params;
  const ranking = resourceRanking(slug);
  const chapter = chapterFor(slug);
  if (!ranking || !chapter) notFound();
  const p = ranking.production;
  return (
    <Shell>
      <Page>
        <SectionHeader
          title={`${ranking.label}: who produces it, who holds it`}
          lede={`${p.label} by country, ${p.year}, and reserves, from ${chapter.source} (${chapter.edition}). Shares, ranks and concentration are computed from those rows.`}
        />
        <p className="resource-line">
          <Link href={`/atlas?view=world&resource=${slug}`}>On the map →</Link> ·{' '}
          <a href={`/resources/${slug}/csv`}>Download CSV</a> ·{' '}
          <a href={p.source.url} rel="noopener noreferrer" target="_blank">
            Source table ↗
          </a>
        </p>
        {p.hhi !== null && (
          <p className="resource-line">
            Concentration of {p.label.toLowerCase()}:{' '}
            <Figure method="hhi">{p.hhi.toFixed(2)}</Figure> on the Herfindahl index over the
            countries listed individually (1.00 is a single supplier).
            {ranking.reserves?.hhi !== null && ranking.reserves?.hhi !== undefined && (
              <>
                {' '}
                Reserves: <Figure method="hhi">{ranking.reserves.hhi.toFixed(2)}</Figure>.
              </>
            )}
          </p>
        )}
        <RankingTable ranking={ranking} />
        <RestrictionsByCountry resource={slug} />
      </Page>
    </Shell>
  );
}
