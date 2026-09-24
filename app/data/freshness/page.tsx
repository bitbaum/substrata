import Link from 'next/link';
import type { Metadata } from 'next';

import { Heading, Page, Shell } from '@/components/portal/Shell';
import { PageHeader } from '@/components/portal/PageHeader';
import { Figure } from '@/components/portal/Figure';
import { FeedTable } from '@/components/freshness/FeedTable';
import { DatasetTable } from '@/components/freshness/DatasetTable';
import { StateBadge } from '@/components/freshness/StateBadge';
import { freshnessReport } from '@/lib/freshness/read';
import { STATE_LABEL, type FreshState } from '@/lib/freshness/status';
import { ageLabel } from '@/lib/event-draft-store';
import { methodHref } from '@/lib/methods';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Freshness',
  description:
    'Every feed and dataset behind the site: when it last ran or was checked, how often it should, and whether it is fresh, late, stale or failing.',
};

const SUMMARY: FreshState[] = ['failing', 'stale', 'late', 'fresh', 'off'];

export default async function FreshnessPage() {
  const report = await freshnessReport();
  const now = new Date(report.checkedAt);
  const all = [
    ...report.feeds.map((f) => f.state),
    ...report.datasets.map((d) => d.state),
    report.queue?.state ?? 'unknown',
  ];
  const counts = SUMMARY.map((s) => [s, all.filter((x) => x === s).length] as const).filter(
    ([, n]) => n > 0,
  );

  return (
    <Shell currentPath="data/freshness">
      <Page>
        <PageHeader
          kicker={
            <>
              <Link href="/data">Data</Link> / Freshness
            </>
          }
          title="Is any of this out of date?"
          status={
            <>
              <StateBadge state={report.state} /> ·{' '}
              {counts.map(([state, n], i) => (
                <span key={state}>
                  {i > 0 && ', '}
                  <Figure method="freshness-state">{String(n)}</Figure>{' '}
                  {STATE_LABEL[state].toLowerCase()}
                </span>
              ))}{' '}
              · measured {now.toISOString().slice(11, 16)} UTC
            </>
          }
          note={
            <>
              Each state is computed from the run tables and the dates the committed files record,
              by <Link href={methodHref('freshness-state')}>one published rule</Link>. A committed
              file past its allowed age fails the build, so it cannot be deployed as current.
              Machine-readable:{' '}
              <Link href="/api/health/freshness" prefetch={false}>
                /api/health/freshness
              </Link>
              .
            </>
          }
          actions={<Link href="/data">Data quality and methods →</Link>}
        />

        {report.attention.length > 0 && (
          <p className="fresh-attention" role="status">
            Needs attention: {report.attention.join(' · ')}
          </p>
        )}

        <section className="mb-12">
          <Heading index="01" title="Scheduled feeds" aside="What the server fetches by itself" />
          <FeedTable rows={report.feeds} now={now} />
        </section>

        <section className="mb-12">
          <Heading index="02" title="Review queue" aside="Leads found, not yet read by a person" />
          {report.queue === null ? (
            <p className="fresh-what">The queue could not be read just now.</p>
          ) : (
            <div className="fresh-queue">
              <StateBadge state={report.queue.state} />
              <p>
                <Figure method="review-queue">{String(report.queue.waiting)}</Figure> lead
                {report.queue.waiting === 1 ? '' : 's'} waiting
                {report.queue.oldestFoundAt && (
                  <>
                    ; the oldest was found{' '}
                    <Figure method="review-queue">
                      {ageLabel(report.queue.oldestFoundAt, now)}
                    </Figure>{' '}
                    ago
                  </>
                )}
                . Leads should be read within {report.queue.maxDays} days.{' '}
                <Link href="/review">Open the review inbox →</Link>
              </p>
            </div>
          )}
        </section>

        <section>
          <Heading index="03" title="Committed datasets" aside="Checked by people and scripts" />
          <DatasetTable rows={report.datasets} />
        </section>
      </Page>
    </Shell>
  );
}
