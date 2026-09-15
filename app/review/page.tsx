import { notFound } from 'next/navigation';
import { auth, isReviewer } from '@/lib/auth';
import { database } from '@/lib/db';
import { Page, Shell, SectionHeader } from '@/components/portal/Shell';
export const dynamic = 'force-dynamic';
async function reviewer() {
  const session = await auth();
  return isReviewer(session?.actorId);
}
export default async function ReviewPage() {
  if (!(await reviewer())) notFound();
  const result = await database().query<{
    id: string;
    message: string;
    topic: string;
    reply_to: string | null;
    credit_name: string | null;
    status: string;
    created_at: Date;
  }>(
    'SELECT id,message,topic,reply_to,credit_name,status,created_at FROM research_contributions ORDER BY created_at DESC LIMIT 100',
  );
  return (
    <Shell currentPath="review">
      <Page>
        <SectionHeader
          title="Research contributions"
          lede="Private review inbox. Accepting a submission here does not publish it into the research corpus."
        />
        <ol className="research-results">
          {result.rows.map((r) => (
            <li key={r.id}>
              <p>
                {r.created_at.toISOString()} · {r.status}
              </p>
              <h2>{r.topic || 'Research contribution'}</h2>
              <p className="whitespace-pre-wrap">{r.message}</p>
              <p>
                Reply: {r.reply_to ?? 'not supplied'} · Credit: {r.credit_name ?? 'anonymous'}
              </p>
              <code>{r.id}</code>
            </li>
          ))}
        </ol>
      </Page>
    </Shell>
  );
}
