import Link from 'next/link';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { auth, authEnabled, currentSession, signIn, signOut, isReviewer } from '@/lib/auth';
import { database } from '@/lib/db';
import { TECHNOLOGIES } from '@/config/substrata-taxonomy';
import { EVENTS, EVENT_EFFECT_LABEL } from '@/config/substrata-events';
import { BOTTLENECKS, type Bottleneck } from '@/lib/bottlenecks';
import { MARKET_PARTICIPANTS } from '@/lib/participants';
import { Page, Shell, SectionHeader } from '@/components/portal/Shell';
import { Chip } from '@/components/portal/Chip';
import { DeskRefresh } from '@/components/portal/DeskRefresh';
import { FollowButton } from '@/components/portal/FollowButton';
import { SeverityBar } from '@/components/portal/Status';
import { bottleneckHref, marketHref } from '@/lib/links';
import { parseFollows, type Follows } from '@/lib/follows';
import { buildFeed, whenLabel, type DeskItem, type Lead } from '@/lib/desk';
import {
  CHECK_NOW_COOLDOWN_HOURS,
  leadsFor,
  railFreshness,
  sweepStaleNow,
} from '@/lib/sweep-store';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Desk' };

const SHOW = ['all', 'verified', 'leads'] as const;
type Show = (typeof SHOW)[number];
const SHOW_LABEL: Record<Show, string> = {
  all: 'Everything',
  verified: 'Verified',
  leads: 'New leads',
};
const PAGE = 30;

async function readFollows(actorId: string): Promise<Follows> {
  try {
    const result = await database().query<{ topics: unknown }>(
      'SELECT topics FROM research_preferences WHERE actor_id=$1',
      [actorId],
    );
    return parseFollows(result.rows[0]?.topics);
  } catch {
    return parseFollows(undefined);
  }
}

/**
 * The bottlenecks a reader's follows reach. Following nothing yet is not an
 * empty desk: it is the whole map, until they narrow it.
 */
function railsOf(follows: Follows): Bottleneck[] {
  const companies = MARKET_PARTICIPANTS.filter((p) => follows.companies.includes(p.slug));
  if (follows.technologies.length === 0 && companies.length === 0) return [...BOTTLENECKS];
  return BOTTLENECKS.filter(
    (b) =>
      b.technologies.some((t) => follows.technologies.includes(t)) ||
      companies.some((p) => b.producers.some((row) => row.name === p.name)),
  );
}

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

async function checkNow() {
  'use server';
  const session = await auth();
  if (!session?.actorId) throw new Error('Sign in first');
  const rails = railsOf(await readFollows(session.actorId)).map((b) => b.name);
  const outcome = await sweepStaleNow(rails, { cooldownHours: CHECK_NOW_COOLDOWN_HOURS });
  redirect(
    `/account?checked=${outcome.swept.length}&found=${outcome.found}&blind=${outcome.couldNotLook}`,
  );
}

function SignedOut() {
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
              'News on your rails, as it breaks',
              'Verified events and the leads the sweep found this week, filtered to what you follow.',
            ],
            [
              'Join the discussion',
              'Every bottleneck, company and note carries a thread. Reading is open to everyone; writing needs an account.',
            ],
          ].map(([title, detail]) => (
            <li key={title} className="py-4">
              <p className="font-medium text-fg-primary">{title}</p>
              <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-secondary">{detail}</p>
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
}

/** Today / Yesterday / This week / Earlier — a feed reads by recency, not by row. */
function bucketOf(item: DeskItem, now: Date): string {
  const day = (iso: string) => Date.parse(iso.slice(0, 10));
  const today = day(now.toISOString());
  const days = Math.round((today - day(item.at)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'This week';
  if (days < 31) return 'This month';
  return 'Earlier';
}

function FeedItem({ item, now }: { item: DeskItem; now: Date }) {
  const primary = item.bottlenecks[0];
  return (
    <li className="desk-item">
      {/* Coloured only where an analyst judged the effect; on a lead it is a guess. */}
      <span
        className={`desk-effect ${item.source === 'event' ? `desk-effect-${item.effect}` : ''}`}
        aria-hidden
      />
      <div className="min-w-0">
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="desk-headline">
          {item.title}
          <span className="desk-external" aria-hidden>
            ↗
          </span>
        </a>
        <p className="desk-meta">
          <time dateTime={item.at}>{whenLabel(item.at, now, item.dateOnly)}</time>
          {item.host && <span>{item.host}</span>}
          {item.source === 'lead' && item.alsoAt.length > 0 && (
            <span title={item.alsoAt.join(', ')}>
              +{item.alsoAt.length} outlet{item.alsoAt.length === 1 ? '' : 's'}
            </span>
          )}
          {primary && (
            <Link href={bottleneckHref(primary)} className="desk-rail-link">
              {primary}
            </Link>
          )}
          {item.source === 'event' ? (
            <span className="desk-badge desk-badge-verified">
              Verified · {EVENT_EFFECT_LABEL[item.effect].toLowerCase()}
            </span>
          ) : (
            <span
              className="desk-badge"
              title="Found by the sweep on the open web. Not yet read by an analyst."
            >
              Unread lead
            </span>
          )}
        </p>
      </div>
    </li>
  );
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    show?: string;
    n?: string;
    checked?: string;
    found?: string;
    blind?: string;
  }>;
}) {
  const session = await currentSession();
  const params = await searchParams;
  if (!session?.actorId) return <SignedOut />;

  const now = new Date();
  const follows = await readFollows(session.actorId);
  const rails = railsOf(follows);
  const railNames = rails.map((b) => b.name);
  const followsNothing = follows.technologies.length + follows.companies.length === 0;
  const followedTech = TECHNOLOGIES.filter((t) => follows.technologies.includes(t.id));
  const followedCo = MARKET_PARTICIPANTS.filter((p) => follows.companies.includes(p.slug));

  // The database is where the live half of the desk lives. If it cannot be read
  // the desk still shows the verified events, and says the rest is missing
  // rather than implying a quiet week.
  let leads: Lead[] | null = null;
  let fresh: Awaited<ReturnType<typeof railFreshness>> | null = null;
  try {
    [leads, fresh] = await Promise.all([leadsFor(railNames), railFreshness(railNames)]);
  } catch {
    leads = null;
  }
  const sweeping = Boolean(fresh && (fresh.sweeping > 0 || fresh.stale > 0));
  if (fresh && fresh.stale > 0) {
    // After the response, never before it: the first paint must not wait on the web.
    after(() => sweepStaleNow(railNames).catch(() => undefined));
  }

  const railSet = new Set(railNames);
  const coNames = new Set(followedCo.map((p) => p.name));
  const events = EVENTS.filter(
    (e) => e.bottlenecks.some((b) => railSet.has(b)) || e.participants.some((p) => coNames.has(p)),
  );
  const feed = buildFeed(events, leads ?? [], now);
  const show: Show = SHOW.includes(params.show as Show) ? (params.show as Show) : 'all';
  const visible = feed.filter(
    (item) =>
      show === 'all' || (show === 'verified' ? item.source === 'event' : item.source === 'lead'),
  );
  const limit = Math.min(Math.max(Number(params.n) || PAGE, PAGE), 300);
  const shown = visible.slice(0, limit);
  const lastDay = feed.filter((item) => now.getTime() - Date.parse(item.at) < 86_400_000).length;
  // Verified rows only. A lead's effect is a keyword guess on a page nobody has
  // read, and a guess summed into a headline number reads as a finding.
  const tightening = feed.filter(
    (item) =>
      item.source === 'event' &&
      item.effect === 'tightens' &&
      now.getTime() - Date.parse(item.at) < 30 * 86_400_000,
  ).length;

  const binding = rails
    .filter((b) => b.horizon === 'now')
    .sort((a, b) => b.binding - a.binding)
    .slice(0, 8);

  const buckets: { label: string; items: DeskItem[] }[] = [];
  for (const item of shown) {
    const label = bucketOf(item, now);
    const last = buckets[buckets.length - 1];
    if (last?.label === label) last.items.push(item);
    else buckets.push({ label, items: [item] });
  }

  const hrefFor = (next: Show) => (next === 'all' ? '/account' : `/account?show=${next}`);
  const firstName = session.user?.name?.split(' ')[0];
  const checked = params.checked !== undefined ? Number(params.checked) : null;

  return (
    <Shell currentPath="account">
      <Page>
        <header className="desk-hero">
          <div>
            <p className="desk-kicker">Desk{firstName ? ` · ${firstName}` : ''}</p>
            <h1 className="desk-title">
              {lastDay > 0
                ? `${lastDay} new on your rails in the last 24 hours.`
                : 'What moved on your rails.'}
            </h1>
            <p className="desk-status">
              {fresh === null ? (
                <>Live leads are unavailable right now — showing verified events only.</>
              ) : fresh.lastSwept === null ? (
                <>The sweep has not looked at your rails yet.</>
              ) : (
                <>
                  Web checked {whenLabel(fresh.lastSwept, now)}
                  {sweeping && <> · checking for more now</>}
                </>
              )}
              {tightening > 0 && (
                <>
                  {' '}
                  · <span className="text-status-negative">
                    {tightening} verified tightening
                  </span>{' '}
                  in 30 days
                </>
              )}
            </p>
          </div>
          <DeskRefresh action={checkNow} sweeping={sweeping} />
        </header>

        {checked !== null && (
          <p role="status" className="desk-notice">
            {checked === 0
              ? `Everything on your rails was checked within the last hour — nothing to re-check yet.`
              : `Checked ${checked} rail${checked === 1 ? '' : 's'}: ${Number(params.found) || 0} new lead${Number(params.found) === 1 ? '' : 's'}${Number(params.blind) > 0 ? `, ${params.blind} could not be reached` : ''}.`}
          </p>
        )}
        {params.saved === '1' && (
          <p role="status" className="desk-notice">
            Rails saved.
          </p>
        )}

        <div className="desk-layout">
          <section aria-labelledby="feed-heading" className="min-w-0">
            <div className="desk-feed-head">
              <h2 id="feed-heading" className="sr-only">
                News on your rails
              </h2>
              <nav aria-label="Filter the feed" className="flex flex-wrap gap-2">
                {SHOW.map((key) => (
                  <Chip
                    key={key}
                    href={hrefFor(key)}
                    active={show === key}
                    label={SHOW_LABEL[key]}
                    count={
                      key === 'all'
                        ? feed.length
                        : feed.filter((i) =>
                            key === 'verified' ? i.source === 'event' : i.source === 'lead',
                          ).length
                    }
                  />
                ))}
              </nav>
            </div>

            {shown.length === 0 ? (
              <p className="desk-empty">
                {show === 'verified'
                  ? 'No verified events on these rails yet.'
                  : 'Nothing new on these rails yet. The sweep is looking — check back shortly.'}
              </p>
            ) : (
              buckets.map((bucket) => (
                <div key={bucket.label} className="desk-bucket">
                  <h3 className="desk-bucket-label">{bucket.label}</h3>
                  <ul>
                    {bucket.items.map((item) => (
                      <FeedItem key={`${item.source}-${item.id}`} item={item} now={now} />
                    ))}
                  </ul>
                </div>
              ))
            )}
            {visible.length > shown.length && (
              <p className="mt-6">
                <Link
                  href={`/account?${show === 'all' ? '' : `show=${show}&`}n=${limit + PAGE}`}
                  className="research-button-ghost"
                  scroll={false}
                >
                  Show more · {visible.length - shown.length} left
                </Link>
              </p>
            )}
            <p className="desk-footnote">
              <strong>Verified</strong> rows were read and filed by an analyst.{' '}
              <strong>Unread leads</strong> are pages the sweep found on the open web and link to
              the source as found; they are not findings until someone reads them.
            </p>
          </section>

          <aside className="desk-aside">
            <section className="desk-panel">
              <div className="desk-panel-head">
                <h2>Binding now</h2>
                <Link href="/bottlenecks">All →</Link>
              </div>
              {binding.length === 0 ? (
                <p className="text-sm text-fg-secondary">Nothing on these rails binds today.</p>
              ) : (
                <ol className="desk-binding">
                  {binding.map((b) => (
                    <li key={b.slug}>
                      <Link href={bottleneckHref(b.slug)}>{b.name}</Link>
                      <SeverityBar value={b.binding} />
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="desk-panel">
              <div className="desk-panel-head">
                <h2>Your rails</h2>
                <span className="font-mono text-xs text-fg-muted">
                  {rails.length} bottleneck{rails.length === 1 ? '' : 's'}
                </span>
              </div>
              {followsNothing && (
                <p className="mb-3 text-sm text-fg-secondary">
                  You follow nothing yet, so the desk shows every rail. Narrow it below.
                </p>
              )}
              {followedTech.length > 0 && (
                <ul className="desk-rail-chips">
                  {followedTech.map((t) => (
                    <li key={t.id}>
                      <Link href={`/atlas?topic=${t.id}`}>{t.name}</Link>
                    </li>
                  ))}
                </ul>
              )}
              {followedCo.length > 0 && (
                <ul className="mt-3 space-y-2 text-sm">
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
              <details className="desk-edit" open={followsNothing}>
                <summary>Edit rails</summary>
                <form action={save} className="mt-3 space-y-4">
                  <fieldset className="desk-toggle-group">
                    <legend className="sr-only">Technologies</legend>
                    {TECHNOLOGIES.map((t) => (
                      <label key={t.id} className="desk-toggle">
                        <input
                          type="checkbox"
                          name="topics"
                          value={t.id}
                          defaultChecked={follows.technologies.includes(t.id)}
                        />
                        <span>{t.name}</span>
                      </label>
                    ))}
                  </fieldset>
                  <fieldset className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-secondary">
                    <legend className="mb-1 text-xs text-fg-muted">I use this desk as</legend>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="kind"
                        value="individual"
                        defaultChecked={follows.kind !== 'organization'}
                      />
                      An individual
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="kind"
                        value="organization"
                        defaultChecked={follows.kind === 'organization'}
                      />
                      An organisation
                    </label>
                  </fieldset>
                  <p className="text-xs text-fg-muted">
                    Companies are followed from their own page —{' '}
                    <Link href="/markets" className="underline-offset-4 hover:underline">
                      browse markets
                    </Link>
                    .
                  </p>
                  <button type="submit" className="research-button">
                    Save rails
                  </button>
                </form>
              </details>
            </section>

            <nav aria-label="Account" className="desk-account-links">
              {isReviewer(session.actorId) && <Link href="/review">Review inbox →</Link>}
              <Link href="/events">All events →</Link>
              <form
                action={async () => {
                  'use server';
                  await signOut({ redirectTo: '/' });
                }}
              >
                <button type="submit">Sign out</button>
              </form>
            </nav>
          </aside>
        </div>
      </Page>
    </Shell>
  );
}
