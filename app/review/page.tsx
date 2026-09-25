import { revalidatePath } from 'next/cache';
import { notFound } from 'next/navigation';

import { auth, isReviewer } from '@/lib/auth';
import { database } from '@/lib/db';
import { freshness } from '@/lib/sweep-queue';
import { ageLabel, openLeadsWithDrafts, reviewQueue } from '@/lib/event-draft-store';
import { openSourceCandidates, recordSourceVerdict, sourceFreshness } from '@/lib/source-store';
import { Page, Shell, SectionHeader, Empty, Heading } from '@/components/portal/Shell';
import { LeadDraft } from '@/components/review/LeadDraft';
import './review.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Review' };

async function reviewer() {
  const session = await auth();
  return isReviewer(session?.actorId);
}

/** A verdict on the producer-sourcing queue; event leads are decided in `./actions.ts`. */
async function decideSource(form: FormData) {
  'use server';
  const session = await auth();
  if (!isReviewer(session?.actorId)) throw new Error('Not a reviewer');
  const id = form.get('id');
  const verdict = form.get('verdict');
  if (typeof id !== 'string') throw new Error('No candidate named');
  if (verdict !== 'accepted' && verdict !== 'rejected') throw new Error('Unknown verdict');
  await recordSourceVerdict(id, verdict, session!.actorId!);
  revalidatePath('/review');
}

/** A lead is only as useful as its source, so the host is shown next to the link. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown source';
  }
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; problem?: string; accepted?: string }>;
}) {
  if (!(await reviewer())) notFound();
  const params = await searchParams;

  // Each half of this page fails on its own. A dead sweep table must not take
  // down the contributions inbox, and vice versa: a review page that 500s is a
  // review page nobody opens.
  const [leads, queue, fresh, sourceLeads, sourceFresh, contributions] = await Promise.all([
    openLeadsWithDrafts().catch(() => null),
    reviewQueue().catch(() => null),
    freshness().catch(() => null),
    openSourceCandidates().catch(() => null),
    sourceFreshness().catch(() => null),
    database()
      .query<{
        id: string;
        message: string;
        topic: string;
        reply_to: string | null;
        credit_name: string | null;
        status: string;
        created_at: Date;
      }>(
        'SELECT id,message,topic,reply_to,credit_name,status,created_at FROM research_contributions ORDER BY created_at DESC LIMIT 100',
      )
      .catch(() => null),
  ]);

  return (
    <Shell currentPath="review">
      <Page>
        <SectionHeader
          title="Review"
          lede="Private. Three feeds arrive here: event leads from the scheduled sweep, with an AI draft to check against its source where a reader has had one written on their own AI key (“Summarise with AI”, or automatic updates they switched on — the site’s free AI never drafts), candidate sources from the scheduled producer-sourcing run, and contributions people sent in. Deciding something here does not publish it — the corpus is files in git, and a row reaches a page when a person commits it."
          stats={[
            { label: 'Open event leads', value: queue?.waiting ?? '—' },
            { label: 'Drafts ready', value: queue?.draftsReady ?? '—' },
            {
              label: 'Nodes swept',
              value: fresh ? `${fresh.nodesCovered}/${fresh.nodesTotal}` : '—',
            },
            { label: 'Open source candidates', value: sourceLeads?.length ?? 0 },
            {
              label: 'Producer rows checked',
              value: sourceFresh ? `${sourceFresh.rowsCovered}/${sourceFresh.rowsTotal}` : '—',
            },
          ]}
        />

        <Heading title="Leads from the sweep" />
        {/* "We did not look" and "we looked and found nothing" are different
            answers, and a reviewer staring at an empty queue deserves to know
            which one this is. */}
        <p className="research-kicker">
          {fresh?.lastRunAt
            ? `The sweep last finished a run at ${fresh.lastRunAt.slice(0, 16).replace('T', ' ')} UTC.`
            : 'The sweep has no completed run on record.'}
        </p>

        {queue && (
          <p className="research-kicker">
            {queue.oldestFoundAt ? `Oldest waiting lead: ${ageLabel(queue.oldestFoundAt)}. ` : ''}
            {queue.lastDraftRunAt
              ? `Drafts are written on demand, on readers’ own keys; the last at ${queue.lastDraftRunAt.slice(0, 16).replace('T', ' ')} UTC. ${queue.undrafted} not drafted yet, ${queue.suggestedNot} suggested not an event.`
              : 'No draft has been written yet — drafts are written on demand, on readers’ own AI keys.'}
          </p>
        )}
        {params.accepted && (
          <p role="status" className="review-note">
            Accepted. It reaches the site when the accepted rows are committed — see below.
          </p>
        )}
        {queue && queue.awaitingCommit > 0 && (
          <div className="review-commit">
            <p>
              {queue.awaitingCommit} accepted event{queue.awaitingCommit === 1 ? '' : 's'} not in
              the corpus yet. In a checkout, run{' '}
              <code>pnpm run research:accept-events file.json</code> with{' '}
              <a href="/review/accepted" download>
                the accepted rows (JSON)
              </a>
              , then commit the file it changes.
            </p>
          </div>
        )}

        {leads === null ? (
          <Empty
            what="The lead queue could not be read."
            next="The sweep database is unreachable."
          />
        ) : leads.length === 0 ? (
          <Empty what="No leads waiting." next="The sweep files new candidates four times a day." />
        ) : (
          <ol className="research-results review-leads">
            {leads.map((lead) => (
              <LeadDraft
                key={lead.id}
                lead={lead}
                problem={params.lead === lead.id ? params.problem : undefined}
              />
            ))}
          </ol>
        )}

        <Heading title="Candidates from producer sourcing" />
        {/* Same distinction as the sweep above: a row the engine could not
            look at is not a row where nothing was found. */}
        <p className="research-kicker">
          {sourceFresh?.lastRunAt
            ? `The sourcing run last finished at ${sourceFresh.lastRunAt.slice(0, 16).replace('T', ' ')} UTC.`
            : 'The sourcing run has no completed run on record.'}
        </p>

        {sourceLeads === null ? (
          <Empty
            what="The candidate queue could not be read."
            next="The sourcing database is unreachable."
          />
        ) : sourceLeads.length === 0 ? (
          <Empty
            what="No candidates waiting."
            next="The scheduled run checks a handful of unsourced producer rows each time it fires."
          />
        ) : (
          <ol className="research-results">
            {sourceLeads.map((lead) => (
              <li key={lead.id}>
                <p className="research-kicker">
                  {lead.producer} · {lead.material} · {hostOf(lead.url)}
                </p>
                <h2>
                  <a href={lead.url} target="_blank" rel="noreferrer noopener">
                    {lead.title || lead.url}
                  </a>
                </h2>
                <p>{lead.excerpt}</p>
                <p className="research-kicker">Matched: {lead.matched}</p>
                <form action={decideSource} className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={lead.id} />
                  <button className="research-button" name="verdict" value="accepted">
                    Worth promoting
                  </button>
                  <button className="research-button-ghost" name="verdict" value="rejected">
                    Not a source
                  </button>
                </form>
              </li>
            ))}
          </ol>
        )}

        <Heading title="Research contributions" />
        {contributions === null ? (
          <Empty what="Contributions could not be read." next="The database is unreachable." />
        ) : contributions.rows.length === 0 ? (
          <Empty what="No contributions yet." />
        ) : (
          <ol className="research-results">
            {contributions.rows.map((r) => (
              <li key={r.id}>
                <p className="research-kicker">
                  {r.created_at.toISOString().slice(0, 16).replace('T', ' ')} · {r.status}
                </p>
                <h2>{r.topic || 'Research contribution'}</h2>
                <p className="whitespace-pre-wrap">{r.message}</p>
                <p className="research-kicker">
                  Reply: {r.reply_to ?? 'not supplied'} · Credit: {r.credit_name ?? 'anonymous'}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Page>
    </Shell>
  );
}
