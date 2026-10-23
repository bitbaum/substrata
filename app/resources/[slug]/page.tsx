import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';

import { Heading, Page, Shell } from '@/components/portal/Shell';
import { ProductionChart } from '@/components/portal/resources/ProductionChart';
import { RankingTable } from '@/components/portal/resources/RankingTable';
import { ReservesVsProduction } from '@/components/portal/resources/ReservesVsProduction';
import { ResourceEvents } from '@/components/portal/resources/ResourceEvents';
import { ResourceGlance } from '@/components/portal/resources/ResourceGlance';
import { ResourceUsers } from '@/components/portal/resources/ResourceUsers';
import { RestrictionsByKind } from '@/components/portal/resources/RestrictionsByKind';
import { PageDiscussion } from '@/components/portal/PageDiscussion';
import { resourceLabel } from '@/config/substrata-resources';
import { buildFeed } from '@/lib/desk';
import {
  hasReservesShares,
  resourceProfile,
  topLine,
  type ResourceProfile,
} from '@/lib/resources/profile';
import { resourcesWithData } from '@/lib/resources/usgs';
import { leadsFor } from '@/lib/sweep-queue';
import type { Lead } from '@/app/markets/[slug]/_sections/leads';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return resourcesWithData().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const profile = resourceProfile(slug);
  return profile
    ? {
        title: `${resourceLabel(slug)}: who produces it, who holds it, who restricts it`,
        description: `${profile.label}: ${topLine(profile)} of world ${profile.glance.world.seriesLabel.toLowerCase()} in ${profile.glance.world.year}; ${profile.glance.restricting} exporting countries restrict it. ${profile.chapter.source}, ${profile.chapter.edition}; OECD inventory.`,
      }
    : {};
}

/** Sweep leads on the bottlenecks this resource feeds; none without a database. */
async function leadsOn(profile: ResourceProfile): Promise<Lead[]> {
  const names = profile.users.map((u) => u.name);
  if (names.length === 0) return [];
  try {
    const feed = buildFeed(profile.events, await leadsFor(names));
    return feed.filter((item): item is Lead => item.source === 'lead').slice(0, 6);
  } catch {
    return [];
  }
}

/**
 * One resource, one anatomy for all of them: the figures at a glance, who
 * produces it (chart, then the full table), where reserves sit against
 * output, who needs it, who restricts it, what has happened. Sections are
 * numbered as they render, so one that is empty for a resource leaves no gap.
 */
export default async function ResourcePage({ params }: RouteParams) {
  const { slug } = await params;
  const profile = resourceProfile(slug);
  if (!profile) notFound();
  const { chapter, ranking } = profile;
  const p = ranking.production;
  const leads = await leadsOn(profile);

  const sections: { id: string; title: string; aside?: string; node: ReactNode }[] = [
    {
      id: 'production-by-country',
      title: 'Production by country',
      aside: `${profile.production.length} listed · ${p.year}`,
      node: (
        <>
          <ProductionChart profile={profile} />
          <RankingTable ranking={ranking} />
        </>
      ),
    },
    ...(hasReservesShares(profile)
      ? [
          {
            id: 'reserves-vs-production',
            title: 'Reserves against production',
            aside: 'where tomorrow’s supply sits',
            node: <ReservesVsProduction profile={profile} />,
          },
        ]
      : []),
    ...(profile.users.length > 0
      ? [
          {
            id: 'who-needs-it',
            title: 'What it holds up',
            aside: `${profile.users.length} bottleneck${profile.users.length === 1 ? '' : 's'}`,
            node: <ResourceUsers profile={profile} />,
          },
        ]
      : []),
    {
      id: 'export-restrictions',
      title: 'Export restrictions',
      aside:
        profile.glance.measures > 0
          ? `${profile.glance.measures} measures · ${profile.glance.restricting} countries`
          : undefined,
      node: <RestrictionsByKind profile={profile} />,
    },
    ...(profile.events.length > 0 || leads.length > 0
      ? [
          {
            id: 'what-has-happened',
            title: 'What has happened',
            aside: `${profile.events.length} dated${leads.length ? ` · ${leads.length} unread leads` : ''}`,
            node: <ResourceEvents profile={profile} leads={leads} />,
          },
        ]
      : []),
  ];

  return (
    <Shell>
      <Page sections>
        <nav
          aria-label="Breadcrumb"
          className="crumbs mb-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary"
        >
          <Link href="/atlas?view=world" className="hover:text-fg-primary">
            Atlas
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/atlas?view=world&resource=${slug}`} className="hover:text-fg-primary">
            {profile.label} on the map
          </Link>
        </nav>
        <header className="place-head">
          <h1 className="place-title">{profile.label}</h1>
          <p className="place-lede">Who produces it, who holds it, who restricts it.</p>
          <p className="place-source">
            {chapter.source}, {chapter.edition}, table “{chapter.table}”,{' '}
            <span className="whitespace-nowrap">read {chapter.retrieved}</span>; OECD inventory of
            export restrictions. <a href={`/resources/${slug}/csv`}>Download CSV</a> ·{' '}
            <a href={p.source.url} rel="noopener noreferrer" target="_blank">
              Source table ↗
            </a>
          </p>
          <div className="mt-6">
            <ResourceGlance profile={profile} />
          </div>
        </header>
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="mt-12 scroll-mt-24">
            <Heading
              id={s.id}
              index={String(i + 1).padStart(2, '0')}
              title={s.title}
              aside={s.aside}
            />
            {s.node}
          </section>
        ))}
        <section id="discussion" className="mt-12 scroll-mt-24">
          <PageDiscussion path={`/resources/${slug}`} />
        </section>
      </Page>
    </Shell>
  );
}
