import Link from 'next/link';

import { FAMILY_BY_ID } from '@/config/careers-roles';
import { SENIORITY_LABEL } from '@/lib/careers';
import type { JobRow } from '@/lib/careers-query';
import { countryName } from '@/lib/careers-geo';
import { whenLabel } from '@/lib/desk';
import { BOTTLENECKS } from '@/lib/bottlenecks';
import '../careers.css';

const NAME = new Map(BOTTLENECKS.map((b) => [b.slug, b.name]));

/**
 * Open roles as a list. The title goes to the posting on the company's own
 * board; nothing is applied for here. Bottleneck chips go to that
 * bottleneck's careers page, and are the rule's filing, not a reviewer's.
 */
export function JobList({ jobs, showCompany = true }: { jobs: JobRow[]; showCompany?: boolean }) {
  const now = new Date();
  return (
    <ul className="careers-list">
      {jobs.map((job) => {
        const at = job.postedAt ?? job.firstSeen;
        return (
          <li key={job.id} className="careers-job">
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="careers-job-title"
            >
              {job.title}
              <span aria-hidden> ↗</span>
            </a>
            <p className="careers-job-meta">
              {showCompany && (
                <Link href={`/careers?company=${job.companySlug}`} className="careers-job-company">
                  {job.company}
                </Link>
              )}
              <span>
                {job.location || job.countries.map(countryName).join(', ') || 'Location not stated'}
              </span>
              {job.remote && <span className="careers-tag">Remote</span>}
              <span>{FAMILY_BY_ID.get(job.family)?.label}</span>
              <span title={SENIORITY_LABEL[job.seniority]}>{SENIORITY_LABEL[job.seniority]}</span>
              <time
                dateTime={at}
                title={job.postedAt ? 'Posted by the employer' : 'First seen by Substrata'}
              >
                {job.postedAt ? 'posted ' : 'seen '}
                {whenLabel(at, now)}
              </time>
            </p>
            {job.bottlenecks.length > 0 && (
              <p className="careers-job-rails">
                {job.bottlenecks.map((slug) => (
                  <Link key={slug} href={`/careers/${slug}`} className="careers-chip">
                    {NAME.get(slug) ?? slug}
                  </Link>
                ))}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
