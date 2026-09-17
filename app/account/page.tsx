import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, authEnabled, currentSession, signIn, signOut, isReviewer } from '@/lib/auth';
import { database } from '@/lib/db';
import { TECHNOLOGIES } from '@/config/substrata-taxonomy';
import { EVENTS } from '@/config/substrata-events';
import { BOTTLENECKS } from '@/lib/bottlenecks';
import { MARKET_PARTICIPANTS } from '@/lib/participants';
import { Page, Shell, SectionHeader } from '@/components/portal/Shell';
import { FollowButton } from '@/components/portal/FollowButton';
import { bottleneckHref, marketHref } from '@/lib/links';
import { parseFollows, type Follows } from '@/lib/follows';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Desk' };

async function save(form: FormData) {
  'use server';
  const session = await auth();
  if (!session?.actorId) throw new Error('Sign in first');
  const technologies = form.getAll('topics').filter((t): t is string => typeof t === 'string');
  const kind = form.get('kind') === 'organization' ? 'organization' : 'individual';
  // Companies are followed from their own pages, not from this form, so they are
  // read back and preserved. Rebuilding the whole record from the form meant a
  // company followed in another tab after this page loaded was silently dropped
  // the next time the desk was saved.
  const existing = await database().query<{ topics: unknown }>(
    'SELECT topics FROM research_preferences WHERE actor_id=$1',
    [session.actorId],
  );
  const companies = parseFollows(existing.rows[0]?.topics).companies;
  const follows = parseFollows({ technologies, companies, kind });
  await database().query(
    'INSERT INTO research_preferences(actor_id,topics) VALUES($1,$2) ON CONFLICT(actor_id) DO UPDATE SET topics=$2,updated_at=now()',
    [session.actorId, JSON.stringify(follows)],
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
            lede="Sign in. Follow technologies and companies. The desk, news and Ask stay on those rails."
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
            <p>Account sign-in is being configured.</p>
          )}
          {/* Signed out, this page was a headline and a button. Say what an
              account is actually for — all of it true of what exists today. */}
          <ul className="mt-10 divide-y divide-subtle border-y border-subtle">
            {[
              [
                'Follow a technology or a company',
                'Technologies are chosen on the desk; a company is followed from its own page.',
              ],
              [
                'A desk on your rails',
                'Recent events and what binds today, filtered to what you follow.',
              ],
              [
                'Join the discussion',
                'Every bottleneck, company and note carries a thread. Reading is open to everyone; writing needs an account.',
              ],
            ].map(([title, detail]) => (
              <li key={title} className="py-4">
                <p className="font-medium text-fg-primary">{title}</p>
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-secondary">
                  {detail}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-prose text-sm text-fg-secondary">
            The research itself needs no account.{' '}
            <Link href="/bottlenecks" className="text-accent underline-offset-4 hover:underline">
              Read the bottlenecks
            </Link>{' '}
            or{' '}
            <Link href="/chat" className="text-accent underline-offset-4 hover:underline">
              ask the corpus a question
            </Link>
            .
          </p>
        </Page>
      </Shell>
    );

  let follows: Follows = parseFollows(undefined);
  try {
    const result = await database().query<{ topics: unknown }>(
      'SELECT topics FROM research_preferences WHERE actor_id=$1',
      [session.actorId],
    );
    follows = parseFollows(result.rows[0]?.topics);
  } catch {
    follows = parseFollows(undefined);
  }
  const followedTech = TECHNOLOGIES.filter((t) => follows.technologies.includes(t.id));
  const followedCo = MARKET_PARTICIPANTS.filter((p) => follows.companies.includes(p.slug));
  const news = EVENTS.filter((event) => {
    const techHit = followedTech.some((t) =>
      BOTTLENECKS.some((b) => b.technologies.includes(t.id) && event.bottlenecks.includes(b.name)),
    );
    const coHit = followedCo.some((p) => event.participants.includes(p.name));
    return techHit || coHit;
  }).slice(0, 8);
  const worst = BOTTLENECKS.filter(
    (b) =>
      b.horizon === 'now' &&
      (followedTech.some((t) => b.technologies.includes(t.id)) ||
        followedCo.some((p) => b.producers.some((row) => row.name === p.name))),
  )
    .sort((a, b) => b.binding - a.binding)
    .slice(0, 6);

  return (
    <Shell currentPath="account">
      <Page>
        <SectionHeader
          title={`Desk${session.user?.name ? ` · ${session.user.name}` : ''}`}
          lede="Your rails: technologies and companies you follow. News, bottlenecks and Ask stay on them."
        />
        {saved === '1' && (
          <p role="status" className="mb-6 text-sm">
            Desk saved.
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
            <p className="text-sm text-fg-secondary">Cited answers from the corpus.</p>
            <p className="mt-4">
              <Link href="/chat" className="research-button">
                Open Ask
              </Link>
            </p>
          </section>
          <section className="desk-card">
            <h2>Following</h2>
            {followedTech.length + followedCo.length === 0 ? (
              <p className="text-sm text-fg-secondary">
                Pick technologies below, and follow a company from its own page —{' '}
                <Link href="/markets" className="text-accent underline-offset-4 hover:underline">
                  browse markets
                </Link>
                .
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {followedTech.map((t) => (
                  <li key={t.id}>
                    <Link href={`/atlas?topic=${t.id}`}>{t.name}</Link>
                  </li>
                ))}
                {followedCo.map((p) => (
                  <li
                    key={p.slug}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
                  >
                    <Link href={marketHref(p.slug)}>{p.name}</Link>
                    {/* The only way to stop following used to be a checkbox in a
                        list of 140; it belongs next to the thing being followed. */}
                    <FollowButton type="company" id={p.slug} following label={p.name} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="desk-card">
            <h2>News on your rails</h2>
            {news.length === 0 ? (
              <p className="text-sm text-fg-secondary">No matching events yet.</p>
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
              <p className="text-sm text-fg-secondary">Follow something to see what binds today.</p>
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
            <legend>I use this desk as</legend>
            <label className="consent-line">
              <input
                type="radio"
                name="kind"
                value="individual"
                defaultChecked={follows.kind !== 'organization'}
              />
              An individual
            </label>
            <label className="consent-line">
              <input
                type="radio"
                name="kind"
                value="organization"
                defaultChecked={follows.kind === 'organization'}
              />
              An organisation
            </label>
          </fieldset>
          <fieldset>
            <legend>Technologies</legend>
            {TECHNOLOGIES.map((t) => (
              <label key={t.id} className="consent-line">
                <input
                  type="checkbox"
                  name="topics"
                  value={t.id}
                  defaultChecked={follows.technologies.includes(t.id)}
                />
                {t.name}
              </label>
            ))}
          </fieldset>
          <button type="submit">Save desk</button>
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
