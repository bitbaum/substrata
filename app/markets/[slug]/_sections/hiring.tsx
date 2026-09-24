import Link from 'next/link';

import { openJobs, type JobRow } from '@/lib/careers-query';
import { boardFor, liveBoards } from '@/lib/job-boards';
import { JobList } from '@/app/careers/_parts/JobList';
import { Figure } from '@/components/portal/Figure';

export interface Hiring {
  careersUrl: string | null;
  live: boolean;
  jobs: JobRow[];
  total: number;
}

/**
 * Where the company hires: its newest open roles when its board is one
 * Substrata reads, otherwise its official careers page. Null when neither is
 * known, so the section is left out rather than shown empty.
 */
export async function hiringOf(slug: string): Promise<Hiring | null> {
  const record = boardFor(slug);
  const live = liveBoards().some((b) => b.slug === slug);
  if (!record?.careersUrl && !live) return null;
  let page = { jobs: [] as JobRow[], total: 0 };
  if (live) {
    try {
      page = await openJobs({ company: slug }, 6);
    } catch {
      // Table not provisioned or database down: the careers link still stands.
    }
  }
  return { careersUrl: record?.careersUrl ?? null, live, ...page };
}

export function HiringSection({ hiring, slug }: { hiring: Hiring; slug: string }) {
  return (
    <>
      {hiring.jobs.length > 0 && <JobList jobs={hiring.jobs} showCompany={false} />}
      <p className="mt-3 max-w-prose text-xs leading-relaxed text-fg-muted">
        {hiring.live ? (
          <>
            <Link href={`/careers?company=${slug}`} className="underline underline-offset-4">
              All{' '}
              <Figure method="careers-open" inLink>
                {String(hiring.total)}
              </Figure>{' '}
              open roles
            </Link>
            , read daily from the company&rsquo;s public job board.{' '}
          </>
        ) : (
          'Its roles are published on its own site, which Substrata links rather than reads. '
        )}
        {hiring.careersUrl && (
          <a
            href={hiring.careersUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            Official careers page ↗
          </a>
        )}
      </p>
    </>
  );
}
