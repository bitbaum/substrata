import { revalidatePath } from 'next/cache';
import { notFound } from 'next/navigation';

import { auth, isReviewer } from '@/lib/auth';
import { database } from '@/lib/db';
import { freshness, openCandidates, recordVerdict } from '@/lib/sweep-store';
import { Page, Shell, SectionHeader, Empty, Heading } from '@/components/portal/Shell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Review' };

async function reviewer() {
  const session = await auth();
  return isReviewer(session?.actorId);
}

/**
 * Decide a lead.
 *
 * Accepting marks a lead as worth writing up; it does not publish anything.
 * The corpus is files in git and a row reaches a page only when a person
 * commits it, which is the site's whole claim — so the strongest thing this
 * button can do is shorten the list of things worth that work.
 */
async function decide(form: FormData) {
  'use server';
  const session = await auth();
  if (!isReviewer(session?.actorId)) throw new Error('Not a reviewer');
  const id = form.get('id');
  const verdict = form.get('verdict');
  if (typeof id !== 'string') throw new Error('No lead named');
  if (verdict !== 'accepted' && verdict !== 'rejected') throw new Error('Unknown verdict');
  await recordVerdict(id, verdict, session!.actorId!);
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

function when(iso: string | null): string {
  return iso ? iso.slice(0, 10) : 'no date given';
}

export default async function ReviewPage() {
  if (!(await reviewer())) notFound();

  // Each half of this page fails on its own. A dead sweep table must not take
  // down the contributions inbox, and vice versa: a review page that 500s is a
  // review page nobody opens.
  const [leads, fresh, contributions] = await Promise.all([
    openCandidates().catch(() => null),
    freshness().catch(() => null),
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
          lede="Private. Two feeds arrive here: leads the scheduled sweep found, and contributions people sent in. Deciding a lead here does not publish it — the corpus is files in git, and a row reaches a page when a person commits it."
          stats={[
            { label: 'Open leads', value: leads?.length ?? 0 },
            {
              label: 'Nodes swept',
              value: fresh ? `${fresh.nodesCovered}/${fresh.nodesTotal}` : '—',
            },
            { label: 'Could not look', value: fresh?.blind ?? 0 },
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

        {leads === null ? (
          <Empty
            what="The lead queue could not be read."
            next="The sweep database is unreachable."
          />
        ) : leads.length === 0 ? (
          <Empty what="No leads waiting." next="The sweep files new candidates four times a day." />
        ) : (
          <ol className="research-results">
            {leads.map((lead) => (
              <li key={lead.id}>
                <p className="research-kicker">
                  {lead.bottleneck} · {hostOf(lead.url)} · published {when(lead.published)} · reads
                  as {lead.effectGuess}
                </p>
                <h2>
                  <a href={lead.url} target="_blank" rel="noreferrer noopener">
                    {lead.title || lead.url}
                  </a>
                </h2>
                <p>{lead.excerpt}</p>
                <form action={decide} className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={lead.id} />
                  <button className="research-button" name="verdict" value="accepted">
                    Worth writing up
                  </button>
                  <button className="research-button-ghost" name="verdict" value="rejected">
                    Not an event
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
