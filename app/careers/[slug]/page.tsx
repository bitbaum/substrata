import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { BOTTLENECK_NEEDS, FAMILY_BY_ID, NEEDS_JUDGED_ON } from '@/config/careers-roles';
import { BOTTLENECKS } from '@/lib/bottlenecks';
import { bottleneckHref } from '@/lib/links';
import { facetCounts, openJobs } from '@/lib/careers-query';
import { pathsFor } from '@/lib/learning-paths';
import { makersOf } from '@/lib/participants';
import { boardFor } from '@/lib/job-boards';
import { JUDGED_BY } from '@/config/substrata-about';
import { Page, Shell } from '@/components/portal/Shell';
import { Figure } from '@/components/portal/Figure';
import { JobList } from '../_parts/JobList';
import { Occupations } from '../_parts/Occupations';
import { Paths } from '../_parts/Paths';
import { SkillCounts } from '../_parts/SkillCounts';
import '../careers.css';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const b = BOTTLENECKS.find((x) => x.slug === slug);
  if (!b) return {};
  return {
    title: `Careers in ${b.name}`,
    description: `Open roles filed under ${b.name}, the roles it needs, the skills those roles ask for, and public ways to train into them.`,
  };
}

async function load(slug: string) {
  try {
    const [page, families, skills] = await Promise.all([
      openJobs({ bottleneck: slug }, 15),
      facetCounts('family', { bottleneck: slug }),
      facetCounts('skill', { bottleneck: slug }),
    ]);
    return { ...page, families, skills };
  } catch {
    return null;
  }
}

/** One bottleneck, for somebody who wants to work on it. */
export default async function BottleneckCareersPage({ params }: RouteParams) {
  const { slug } = await params;
  const b = BOTTLENECKS.find((x) => x.slug === slug);
  if (!b) notFound();
  const needs = BOTTLENECK_NEEDS[slug] ?? [];
  const data = await load(slug);
  const makers = makersOf(b.name).filter((p) => boardFor(p.slug)?.careersUrl);

  return (
    <Shell>
      <Page>
        <nav
          aria-label="Breadcrumb"
          className="crumbs mb-6 font-mono text-xs uppercase tracking-caps text-fg-tertiary"
        >
          <Link href="/careers" className="hover:text-fg-primary">
            Careers
          </Link>
        </nav>
        <header className="careers-head">
          <p className="desk-kicker">Work on this bottleneck</p>
          <h1 className="desk-title">{b.name}</h1>
          <p className="desk-status">
            {data ? (
              <>
                <Figure method="careers-classify">{String(data.total)}</Figure> open role
                {data.total === 1 ? '' : 's'} filed here ·{' '}
              </>
            ) : null}
            <Link href={bottleneckHref(b.slug)}>Why it binds, and who holds it</Link>
          </p>
          <p className="careers-disclaimer">{b.plain}</p>
        </header>

        <section className="careers-section" aria-labelledby="needs">
          <div className="careers-section-head">
            <h2 id="needs">The roles it needs</h2>
            <p>
              Judged by {JUDGED_BY} · {NEEDS_JUDGED_ON} · not reviewed by anyone who hires for it
            </p>
          </div>
          <div className="careers-grid">
            {needs.map((id) => {
              const f = FAMILY_BY_ID.get(id);
              const n = data?.families.get(id) ?? 0;
              return (
                <article key={id} className="careers-card">
                  <h3>
                    <Link href={`/careers/paths#${id}`}>{f?.label}</Link>
                  </h3>
                  <p>{f?.who}</p>
                  <p>
                    <Link href={`/careers?bottleneck=${slug}&family=${id}`}>
                      <Figure method="careers-classify" inLink>
                        {String(n)}
                      </Figure>{' '}
                      open here
                    </Link>
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        {data && data.jobs.length > 0 && (
          <section className="careers-section" aria-labelledby="open">
            <div className="careers-section-head">
              <h2 id="open">Open roles</h2>
              <p>
                <Link href={`/careers?bottleneck=${slug}`}>All with filters →</Link>
              </p>
            </div>
            <JobList jobs={data.jobs} />
          </section>
        )}

        {data && data.total > 0 && data.skills.size > 0 && (
          <section className="careers-section" aria-labelledby="skills">
            <div className="careers-section-head">
              <h2 id="skills">What these postings ask for</h2>
              <p>Counted across the open roles above, by a published list of terms</p>
            </div>
            <SkillCounts counts={data.skills} total={data.total} />
          </section>
        )}

        {needs.map((id) => (
          <section key={id} className="careers-section" aria-labelledby={`occ-${id}`}>
            <div className="careers-section-head">
              <h2 id={`occ-${id}`}>{FAMILY_BY_ID.get(id)?.label}: the official record</h2>
              <p>What O*NET and ESCO say the work is and needs</p>
            </div>
            <Occupations family={id} />
          </section>
        ))}

        <section className="careers-section" aria-labelledby="train">
          <div className="careers-section-head">
            <h2 id="train">Where to train</h2>
            <p>Public programmes for these role families, each on its official page</p>
          </div>
          <Paths paths={pathsFor(needs)} />
        </section>

        {makers.length > 0 && (
          <section className="careers-section" aria-labelledby="makers">
            <div className="careers-section-head">
              <h2 id="makers">Who holds it, and where they hire</h2>
            </div>
            <ul className="careers-terms">
              {makers.map((p) => (
                <li key={p.slug}>
                  <a
                    href={boardFor(p.slug)?.careersUrl ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {p.name} careers ↗
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Page>
    </Shell>
  );
}
