import Link from 'next/link';
import type { Metadata } from 'next';

import { ROLE_FAMILIES } from '@/config/careers-roles';
import { SENIORITIES, SENIORITY_LABEL } from '@/lib/careers';
import { countryName } from '@/lib/careers-geo';
import {
  facetCounts,
  lastJobRun,
  openJobs,
  parseJobFilter,
  type JobFilter,
} from '@/lib/careers-query';
import { liveBoards } from '@/lib/job-boards';
import { participantBySlug } from '@/lib/participants';
import { currentSession } from '@/lib/auth';
import { readFollows } from '@/lib/desk-store';
import { whenLabel } from '@/lib/desk';
import { Page, Shell } from '@/components/portal/Shell';
import { Figure } from '@/components/portal/Figure';
import { PageHeader } from '@/components/portal/PageHeader';
import { AutoSubmitForm } from '@/components/portal/AutoSubmitForm';
import { JobList } from './_parts/JobList';
import { HiringByBottleneck } from './_parts/HiringByBottleneck';
import { FollowJobs } from './_parts/FollowJobs';
import './careers.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Careers',
  description:
    'Open roles at the companies that hold the bottlenecks, which bottlenecks are hiring most, and how to train into them.',
};

const PAGE = 40;
type Params = Record<string, string | string[] | undefined>;

async function load(filter: JobFilter, shown: number) {
  try {
    const [page, byBottleneck, byFamily, byCountry, run] = await Promise.all([
      openJobs(filter, shown),
      facetCounts('bottleneck', { ...filter, bottleneck: undefined }),
      facetCounts('family', { ...filter, family: undefined }),
      facetCounts('country', { ...filter, country: undefined }),
      lastJobRun(),
    ]);
    return { ...page, byBottleneck, byFamily, byCountry, run };
  } catch {
    return null;
  }
}

export default async function CareersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const filter = parseJobFilter(params);
  const shown = Math.min(Math.max(Number(params.n) || PAGE, PAGE), 400);
  const data = await load(filter, shown);
  const boards = liveBoards();
  const session = await currentSession();
  const follows = session?.actorId ? await readFollows(session.actorId).catch(() => null) : null;
  const company = filter.company ? participantBySlug(filter.company) : undefined;
  const more = new URLSearchParams(
    Object.entries({ ...params, n: String(shown + PAGE) }).flatMap(([k, v]) =>
      typeof v === 'string' && v ? [[k, v]] : [],
    ),
  ).toString();

  return (
    <Shell currentPath="careers">
      <Page>
        <PageHeader
          kicker="Careers"
          title="Work on the bottlenecks."
          status={
            data ? (
              <>
                <Figure method="careers-open">{String(data.total)}</Figure> open role
                {data.total === 1 ? '' : 's'} on the public boards of{' '}
                <Figure method="careers-open">{String(boards.length)}</Figure> directory companies ·{' '}
                {data.run ? `boards read ${whenLabel(data.run.at)}` : 'not read yet'} ·{' '}
                <Link href="/careers/companies">every company&rsquo;s careers page</Link> ·{' '}
                <Link href="/careers/paths">skills and training</Link>
              </>
            ) : (
              'The job board could not be read just now. The companies’ careers pages and the training paths still are.'
            )
          }
          note={
            <>
              Each role links to the posting on the company&rsquo;s own board; apply there.
              Substrata is not an employer or a recruiter. Roles are filed under bottlenecks and
              role families by{' '}
              <Link href="/data#method-careers-classify">published word rules</Link>, not by a
              reader, so a filing can be wrong. Pay is not shown.
            </>
          }
        />

        <div className="careers-layout">
          <aside className="careers-aside">
            {data && data.byBottleneck.size > 0 && (
              <HiringByBottleneck counts={data.byBottleneck} filter={filter} />
            )}
          </aside>
          <div className="careers-main">
            <AutoSubmitForm action="/careers" className="desk-filters">
              <label className="desk-filter desk-filter-q">
                <span className="sr-only">Search titles</span>
                <input
                  type="search"
                  name="q"
                  defaultValue={filter.q}
                  placeholder="Title: technician, etch, lineworker…"
                  maxLength={80}
                />
              </label>
              <label className="desk-filter">
                <span className="sr-only">Role family</span>
                <select name="family" defaultValue={filter.family ?? ''}>
                  <option value="">All role families</option>
                  {ROLE_FAMILIES.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                      {data?.byFamily.get(f.id) ? ` (${data.byFamily.get(f.id)})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="desk-filter">
                <span className="sr-only">Company</span>
                <select name="company" defaultValue={filter.company ?? ''}>
                  <option value="">All companies</option>
                  {boards.map((b) => (
                    <option key={b.slug} value={b.slug}>
                      {b.company}
                    </option>
                  ))}
                </select>
              </label>
              <label className="desk-filter">
                <span className="sr-only">Country</span>
                <select name="country" defaultValue={filter.country ?? ''}>
                  <option value="">All countries</option>
                  {[...(data?.byCountry ?? new Map<string, number>())].map(([code, n]) => (
                    <option key={code} value={code}>
                      {countryName(code)} ({n})
                    </option>
                  ))}
                </select>
              </label>
              <label className="desk-filter">
                <span className="sr-only">Seniority</span>
                <select name="level" defaultValue={filter.seniority ?? ''}>
                  <option value="">Any seniority</option>
                  {SENIORITIES.map((s) => (
                    <option key={s} value={s}>
                      {SENIORITY_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
              {filter.bottleneck && (
                <input type="hidden" name="bottleneck" value={filter.bottleneck} />
              )}
              <label className="desk-filter">
                <span className="sr-only">Scope</span>
                <select name="scope" defaultValue={filter.all ? 'all' : ''}>
                  <option value="">Roles in the chain</option>
                  <option value="all">Every role, incl. software and business</option>
                </select>
              </label>
              <label className="careers-check">
                <input type="checkbox" name="remote" value="1" defaultChecked={filter.remote} />
                Remote
              </label>
            </AutoSubmitForm>

            {follows && (filter.company || filter.family) && (
              <FollowJobs follows={follows.jobs} company={company} family={filter.family} />
            )}

            {data &&
              (data.jobs.length === 0 ? (
                <p className="desk-empty">
                  No open roles match. <Link href="/careers">Clear the filters</Link>, or see{' '}
                  <Link href="/careers/companies">
                    companies whose roles live on their own site
                  </Link>
                  .
                </p>
              ) : (
                <>
                  <p className="desk-showing">
                    Showing {data.jobs.length} of{' '}
                    <Figure method="careers-open">{String(data.total)}</Figure>, newest first
                    {company && (
                      <>
                        {' · '}
                        <Link href={`/markets/${company.slug}`}>{company.name}: what it holds</Link>
                      </>
                    )}
                  </p>
                  <JobList jobs={data.jobs} showCompany={!filter.company} />
                  {data.total > data.jobs.length && (
                    <p className="careers-more">
                      <Link href={`/careers?${more}`} scroll={false}>
                        Show more
                      </Link>
                    </p>
                  )}
                </>
              ))}
          </div>
        </div>
      </Page>
    </Shell>
  );
}
