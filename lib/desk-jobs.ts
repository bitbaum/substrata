/**
 * New job postings as desk rows: roles at the companies and in the role
 * families a reader follows for jobs (/careers). A posting is dated by when
 * the employer published it, or when Substrata first saw it if that is
 * earlier or the board does not say.
 */
import type { DeskItem } from '@/lib/desk';
import { newJobsFor, type JobRow } from '@/lib/careers-query';
import type { JobFollows } from '@/lib/job-follows';
import { BOTTLENECKS } from '@/lib/bottlenecks';
import { hostOf } from '@/lib/desk';

const NAME = new Map(BOTTLENECKS.map((b) => [b.slug, b.name]));

export function jobItems(jobs: readonly JobRow[]): DeskItem[] {
  return jobs.map((job) => {
    const posted = job.postedAt && job.postedAt < job.firstSeen ? job.postedAt : job.firstSeen;
    return {
      source: 'job',
      id: job.id,
      at: posted,
      title: `${job.company} — ${job.title}`,
      url: job.url,
      host: hostOf(job.url),
      bottlenecks: job.bottlenecks.map((slug) => NAME.get(slug) ?? slug),
      effect: 'neutral',
      location: job.location,
      dateOnly: false,
    };
  });
}

/** The desk's job rows for what a reader follows; none when the table cannot be read. */
export async function followedJobItems(jobs: JobFollows, days: number): Promise<DeskItem[]> {
  try {
    return jobItems(await newJobsFor(jobs.companies, jobs.families, days));
  } catch {
    return [];
  }
}
