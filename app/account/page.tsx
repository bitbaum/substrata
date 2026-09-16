import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, authEnabled, signIn, signOut, isReviewer } from '@/lib/auth';
import { database } from '@/lib/db';
import { TECHNOLOGIES } from '@/config/substrata-taxonomy';
import { Page, Shell, SectionHeader } from '@/components/portal/Shell';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your research desk' };
async function save(form: FormData) {
  'use server';
  const session = await auth();
  if (!session?.actorId) throw new Error('Sign in first');
  const topics = form
    .getAll('topics')
    .filter((t): t is string => typeof t === 'string' && TECHNOLOGIES.some((x) => x.id === t));
  await database().query(
    'INSERT INTO research_preferences(actor_id,topics) VALUES($1,$2) ON CONFLICT(actor_id) DO UPDATE SET topics=$2,updated_at=now()',
    [session.actorId, JSON.stringify(topics)],
  );
  redirect('/account?saved=1');
}
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await auth();
  const { saved } = await searchParams;
  if (!session?.actorId)
    return (
      <Shell currentPath="account">
        <Page>
          <SectionHeader
            title="Your research desk"
            lede="Save the technologies you follow and return to them from any device. Your OrangeCat account signs you in to Substrata."
          />
          <ul className="mb-6 max-w-prose list-disc space-y-2 pl-5 text-fg-secondary">
            <li>Keep a short list of technologies and open their chains in one click.</li>
            <li>Ask the assistant with that context still in view.</li>
            <li>Public research stays free to read without an account.</li>
          </ul>
          {authEnabled ? (
            <form
              action={async () => {
                'use server';
                await signIn('orangecat', { redirectTo: '/account' });
              }}
            >
              <button className="research-button">Continue with OrangeCat</button>
            </form>
          ) : (
            <p>Account sign-in is being configured. Public research and chat remain available.</p>
          )}
          <p className="mt-6 text-sm text-fg-tertiary">
            <Link href="/chat" className="text-accent underline-offset-4 hover:underline">
              Ask without signing in →
            </Link>
          </p>
        </Page>
      </Shell>
    );
  const result = await database().query<{ topics: string[] }>(
    'SELECT topics FROM research_preferences WHERE actor_id=$1',
    [session.actorId],
  );
  const topics = result.rows[0]?.topics ?? [];
  return (
    <Shell currentPath="account">
      <Page>
        <SectionHeader
          title="Your research desk"
          lede={`Welcome${session.user?.name ? `, ${session.user.name}` : ''}. Choose the technologies you want to follow.`}
        />
        {saved === '1' && <p role="status">Your interests are saved.</p>}
        {isReviewer(session.actorId) && (
          <p className="my-5">
            <Link href="/review" className="text-accent underline">
              Open the research contribution inbox →
            </Link>
          </p>
        )}
        <form action={save} className="research-form">
          <fieldset>
            <legend>My interests</legend>
            {TECHNOLOGIES.map((t) => (
              <label key={t.id} className="consent-line">
                <input
                  type="checkbox"
                  name="topics"
                  value={t.id}
                  defaultChecked={topics.includes(t.id)}
                />
                {t.name}
              </label>
            ))}
          </fieldset>
          <button type="submit">Save interests</button>
        </form>
        <div className="research-card-grid">
          {TECHNOLOGIES.filter((t) => topics.includes(t.id)).map((t) => (
            <article key={t.id}>
              <h2>{t.name}</h2>
              <p>{t.detail}</p>
              <Link href={`/atlas?topic=${t.id}`}>Explore the chain →</Link>
              <Link href={`/bottlenecks?tech=${t.id}`}>Browse bottlenecks →</Link>
            </article>
          ))}
        </div>
        <form
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/' });
          }}
        >
          <button className="research-button">Sign out</button>
        </form>
      </Page>
    </Shell>
  );
}
