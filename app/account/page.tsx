import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, authEnabled, currentSession, signIn, signOut, isReviewer } from '@/lib/auth';
import { database } from '@/lib/db';
import { TECHNOLOGIES } from '@/config/substrata-taxonomy';
import { EVENTS } from '@/config/substrata-events';
import { BOTTLENECKS } from '@/lib/bottlenecks';
import { Page, Shell, SectionHeader } from '@/components/portal/Shell';
import { bottleneckHref } from '@/lib/links';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Desk' };

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
  const session = await currentSession();
  const { saved } = await searchParams;
  if (!session?.actorId)
    return (
      <Shell currentPath="account">
        <Page>
          <SectionHeader
            title="Your research desk"
            lede="Sign in with OrangeCat. The desk remembers the technologies you follow, opens their chains, and keeps Ask Substrata next to the map."
          />
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
  const followed = TECHNOLOGIES.filter((t) => topics.includes(t.id));
  const news = EVENTS.filter((event) =>
    followed.some((t) =>
      BOTTLENECKS.some((b) => b.technologies.includes(t.id) && event.bottlenecks.includes(b.name)),
    ),
  ).slice(0, 6);
  const worst = BOTTLENECKS.filter(
    (b) => b.horizon === 'now' && followed.some((t) => b.technologies.includes(t.id)),
  )
    .sort((a, b) => b.binding - a.binding)
    .slice(0, 5);

  return (
    <Shell currentPath="account">
      <Page>
        <SectionHeader
          title={`Desk${session.user?.name ? ` · ${session.user.name}` : ''}`}
          lede="Follow technologies. The map, the news and the assistant stay on those rails."
        />
        {saved === '1' && (
          <p role="status" className="mb-6 text-sm">
            Interests saved.
          </p>
        )}
        {isReviewer(session.actorId) && (
          <p className="mb-6">
            <Link href="/review" className="text-accent underline-offset-4 hover:underline">
              Contribution inbox →
            </Link>
          </p>
        )}
        <div className="desk-grid">
          <section className="desk-card">
            <h2>Ask</h2>
            <p className="text-sm text-fg-secondary">
              Cited answers from the corpus. Contributions go to a private inbox, not the public
              pages.
            </p>
            <p className="mt-4">
              <Link href="/chat" className="research-button">
                Open Ask Substrata
              </Link>
            </p>
          </section>
          <section className="desk-card">
            <h2>Following</h2>
            {followed.length === 0 ? (
              <p className="text-sm text-fg-secondary">Pick at least one technology below.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {followed.map((t) => (
                  <li key={t.id}>
                    <Link href={`/atlas?topic=${t.id}`}>{t.name}</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="desk-card">
            <h2>News on your rails</h2>
            {news.length === 0 ? (
              <p className="text-sm text-fg-secondary">
                No dated events match the technologies you follow yet.
              </p>
            ) : (
              <ul className="space-y-3 text-sm">
                {news.map((event) => (
                  <li key={event.id}>
                    <span className="font-mono text-xs text-fg-tertiary">{event.date}</span>
                    <p>{event.headline}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="desk-card">
            <h2>Binding now</h2>
            {worst.length === 0 ? (
              <p className="text-sm text-fg-secondary">
                Follow a technology to see the bottlenecks judged to bind today.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {worst.map((b) => (
                  <li key={b.slug}>
                    <Link href={bottleneckHref(b.slug)}>{b.name}</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <form action={save} className="research-form mt-10">
          <fieldset>
            <legend>Technologies to follow</legend>
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
          <button type="submit">Save</button>
        </form>
        <form
          className="mt-8"
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/' });
          }}
        >
          <button className="research-button-ghost">Sign out</button>
        </form>
      </Page>
    </Shell>
  );
}
