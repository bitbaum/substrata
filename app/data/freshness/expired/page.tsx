import Link from 'next/link';
import type { Metadata } from 'next';

import { Empty, Page, Shell } from '@/components/portal/Shell';
import { PageHeader } from '@/components/portal/PageHeader';
import { Figure } from '@/components/portal/Figure';
import { LEAD_EXPIRY_DAYS } from '@/lib/lead-expiry';
import { methodHref } from '@/lib/methods';
import { expiredCandidates } from '@/lib/sweep-review';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Expired leads',
  description: `Sweep leads nobody reviewed within ${LEAD_EXPIRY_DAYS} days: kept on record, no longer in the review queue, never findings.`,
};

/** How many are listed; the count in the header is the full one only when the list is shorter. */
const LIMIT = 200;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown source';
  }
}

/**
 * The leads that left the review queue unread. Expiry is a reading, not a
 * deletion (lib/lead-expiry.ts), so this page is the proof: every one of them
 * is still here, with the page it points to.
 */
export default async function ExpiredLeadsPage() {
  const leads = await expiredCandidates(LIMIT).catch(() => null);

  return (
    <Shell>
      <Page>
        <PageHeader
          kicker={
            <>
              <Link href="/data">Data</Link> / <Link href="/data/freshness">Freshness</Link> /
              Expired leads
            </>
          }
          title="Expired, never reviewed"
          status={
            leads === null ? (
              'The lead table could not be read just now.'
            ) : (
              <>
                <Figure method="lead-expiry">
                  {leads.length === LIMIT ? `${LIMIT}+` : String(leads.length)}
                </Figure>{' '}
                lead{leads.length === 1 ? '' : 's'}, newest first
              </>
            )
          }
          note={
            <>
              Pages the research sweep found that nobody reviewed within {LEAD_EXPIRY_DAYS} days.
              They left the review queue so its age measures whether the queue works, not whether
              someone found the time — <Link href={methodHref('lead-expiry')}>the rule</Link>. They
              are kept, not deleted, and none of them is a finding.
            </>
          }
          actions={<Link href="/data/freshness">Freshness →</Link>}
        />

        {leads === null ? (
          <Empty what="The expired leads could not be read." next="The database is unreachable." />
        ) : leads.length === 0 ? (
          <Empty what="No lead has expired." />
        ) : (
          <ol className="research-results">
            {leads.map((lead) => (
              <li key={lead.id}>
                <p className="research-kicker">
                  Expired, never reviewed · found {lead.foundAt.slice(0, 10)} · {lead.bottleneck} ·{' '}
                  {hostOf(lead.url)}
                </p>
                <h2>
                  <a href={lead.url} target="_blank" rel="noreferrer noopener">
                    {lead.title || lead.url}
                  </a>
                </h2>
                {lead.excerpt && <p>{lead.excerpt}</p>}
              </li>
            ))}
          </ol>
        )}
      </Page>
    </Shell>
  );
}
