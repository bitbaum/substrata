import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { AUDIENCES, audienceById, audienceHref, type AudienceId } from '@/config/audiences';
import { currentSession } from '@/lib/auth';
import { freshnessReport, type FreshnessReport } from '@/lib/freshness/read';
import { Page, Shell } from '@/components/portal/Shell';
import { PageHeader } from '@/components/portal/PageHeader';
import { StateBadge } from '@/components/freshness/StateBadge';
import { RoleTabs } from '@/components/roles/RoleSection';
import { EquitiesView } from './Equities';
import { CommoditiesView } from './Commodities';
import { IndustryView } from './Industry';
import { JobsView } from './Jobs';
import { LearningView } from './Learning';
import '../../xray/xray.css';
import '../../careers/careers.css';

/** Metadata for one role view's route file. */
export function roleMetadata(id: AudienceId): Metadata {
  const audience = audienceById(id);
  if (!audience) return {};
  return { title: `For ${audience.label.toLowerCase()}`, description: audience.hint };
}

async function view(id: AudienceId, report: FreshnessReport, signedIn: boolean) {
  switch (id) {
    case 'equities':
      return <EquitiesView report={report} signedIn={signedIn} />;
    case 'commodities':
      return <CommoditiesView report={report} />;
    case 'industry':
      return <IndustryView report={report} />;
    case 'jobs':
      return <JobsView report={report} />;
    case 'learning':
      return <LearningView />;
  }
}

/**
 * One reader, one page: the sections of the site that serve them, in the
 * order they would use them, each linking to the full screen it came from.
 */
export async function RolePage({ id }: { id: AudienceId }) {
  const audience = audienceById(id);
  if (!audience) notFound();
  const [session, report] = await Promise.all([currentSession(), freshnessReport()]);
  const signedIn = Boolean(session?.actorId);

  return (
    <Shell currentPath={`for/${audience.id}`}>
      <Page>
        <RoleTabs
          current={audience.id}
          items={AUDIENCES.map((a) => ({ id: a.id, iAm: a.iAm, href: audienceHref(a.id) }))}
        />
        <PageHeader
          kicker={`For ${audience.label.toLowerCase()}`}
          title={audience.title}
          status={
            <>
              {audience.serves.join(' · ')} ·{' '}
              <Link href="/data/freshness" className="role-feed">
                Site data <StateBadge state={report.state} />
              </Link>
            </>
          }
          actions={
            signedIn ? (
              <Link href="/account">Your desk →</Link>
            ) : (
              <Link href="/account">Sign in to follow bottlenecks →</Link>
            )
          }
        />
        {await view(audience.id, report, signedIn)}
      </Page>
    </Shell>
  );
}
