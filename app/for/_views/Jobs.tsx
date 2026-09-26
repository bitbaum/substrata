import Link from 'next/link';
import { facetCounts, openJobs, parseJobFilter, type JobRow } from '@/lib/careers-query';
import { LEARNING_PATHS } from '@/lib/learning-paths';
import type { FreshnessReport } from '@/lib/freshness/read';
import { FeedStatus, Rows } from '@/components/roles/RoleParts';
import { RoleSection } from '@/components/roles/RoleSection';
import { HiringByBottleneck } from '../../careers/_parts/HiringByBottleneck';
import { JobList } from '../../careers/_parts/JobList';
import { Paths } from '../../careers/_parts/Paths';

async function load(): Promise<{
  jobs: JobRow[];
  total: number;
  counts: Map<string, number>;
} | null> {
  const filter = parseJobFilter({});
  try {
    const [page, counts] = await Promise.all([
      openJobs(filter, 10),
      facetCounts('bottleneck', filter),
    ]);
    return { jobs: page.jobs, total: page.total, counts };
  } catch {
    return null;
  }
}

/** Roles by the bottleneck they work on, the newest postings, and how to train in. */
export async function JobsView({ report }: { report: FreshnessReport }) {
  const data = await load();
  const feed = report.feeds.find((f) => f.feed.id === 'jobs');
  const changers = LEARNING_PATHS.filter((p) => p.careerChangers).slice(0, 4);

  return (
    <div className="role-grid">
      <RoleSection
        index="01"
        title="Newest open roles"
        why="Postings on the companies’ own public boards, newest first. Apply there: Substrata is not an employer or a recruiter."
        href="/careers"
        more={
          data
            ? `All ${data.total} roles, filterable by family, country and seniority`
            : 'All roles'
        }
        status={<FeedStatus row={feed} />}
        wide
      >
        {data === null ? (
          <p className="role-empty">
            The job boards could not be read just now.{' '}
            <Link href="/careers/companies">Every company&rsquo;s own careers page</Link> still
            works.
          </p>
        ) : (
          <JobList jobs={data.jobs} />
        )}
      </RoleSection>
      <RoleSection
        index="02"
        title="Which bottlenecks are hiring"
        why="Open roles filed under each bottleneck by published word rules; one role can sit under several. Pick one for its roles, skills and training."
        href="/careers"
        more="Careers, by bottleneck"
      >
        {data && data.counts.size > 0 ? (
          <HiringByBottleneck counts={data.counts} filter={{}} />
        ) : (
          <p className="role-empty">
            No roles filed under a bottleneck yet. <Link href="/careers">Browse every role</Link>.
          </p>
        )}
      </RoleSection>
      <RoleSection
        index="03"
        title="Train into it"
        why="Programmes whose own page addresses people changing careers, each checked on the provider’s site."
        href="/careers/paths"
        more="Skills and every training path"
      >
        <Paths paths={changers} />
        <Rows
          rows={[
            {
              key: 'companies',
              title: 'Every company’s careers page',
              href: '/careers/companies',
              meta: 'including those whose roles live on their own site',
            },
            {
              key: 'talent',
              title: 'The expertise that is scarce',
              href: '/talent',
              meta: 'the skills needed to ramp a factory or connect a grid',
            },
          ]}
          empty=""
        />
      </RoleSection>
    </div>
  );
}
