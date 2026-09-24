import Link from 'next/link';
import { after } from 'next/server';

import { authEnabled, currentSession, signIn, isReviewer } from '@/lib/auth';
import { EVENTS } from '@/config/substrata-events';
import { MARKET_PARTICIPANTS } from '@/lib/participants';
import { Page, Shell, SectionHeader } from '@/components/portal/Shell';
import { DeskHeader } from '@/components/desk/DeskHeader';
import { MovedStrip } from '@/components/desk/MovedStrip';
import { FeedControls } from '@/components/desk/FeedControls';
import { FeedItem } from '@/components/desk/FeedItem';
import { DeskAside } from '@/components/desk/DeskAside';
import { bottleneckHref } from '@/lib/links';
import { railsOf } from '@/lib/follows';
import { readFollows, readMarks } from '@/lib/desk-store';
import { parseDeskQuery, type Params } from '@/lib/desk-query';
import { buildFeed, type DeskItem, type Lead } from '@/lib/desk';
import { applyFilter, isRead, itemKey, railActivity, VIEWS, type View } from '@/lib/desk-filter';
import { sweepStaleNow } from '@/lib/sweep-store';
import { leadsFor, railFreshness } from '@/lib/sweep-queue';
import { ageLabel, reviewQueue } from '@/lib/event-draft-store';
import { filingsFor } from '@/lib/filings-store';
import { filingItems, registrantsOn } from '@/lib/desk-filings';
import type { Filing } from '@/lib/filings';
import { newItems, type StoredItem } from '@/lib/science-read';
import { scienceItems } from '@/lib/desk-science';
import { allSeries } from '@/lib/series-store';
import { seriesItems } from '@/lib/desk-series';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Desk' };

function SignedOut() {
  return (
    <Shell currentPath="account">
      <Page>
        <SectionHeader
          title="Your research desk"
          lede="Sign in and choose the bottlenecks you care about. The desk collects what moved on them — verified events and fresh leads from the web — and lets you work through it."
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
        <p className="mt-6 max-w-prose text-sm text-fg-secondary">
          The research itself needs no account.{' '}
          <Link href="/bottlenecks" className="text-accent underline-offset-4 hover:underline">
            Read the bottlenecks
          </Link>
          .
        </p>
      </Page>
    </Shell>
  );
}

function bucketOf(item: DeskItem, now: Date): string {
  const day = (iso: string) => Date.parse(iso.slice(0, 10));
  const days = Math.round((day(now.toISOString()) - day(item.at)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'This week';
  if (days < 31) return 'This month';
  return 'Earlier';
}

function group(
  items: DeskItem[],
  by: 'day' | 'bottleneck',
  now: Date,
  railHref: (n: string) => string,
) {
  if (by === 'bottleneck') {
    return railActivity(items).map((a) => ({
      label: a.name,
      href: railHref(a.name),
      items: items.filter((i) => i.bottlenecks[0] === a.name),
    }));
  }
  const groups: { label: string; href?: string; items: DeskItem[] }[] = [];
  for (const item of items) {
    const label = bucketOf(item, now);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await currentSession();
  const params = await searchParams;
  if (!session?.actorId) return <SignedOut />;

  const now = new Date();
  const actorId = session.actorId;
  const [follows, marks] = await Promise.all([readFollows(actorId), readMarks(actorId)]);
  const settings = follows.desk;
  const rails = railsOf(follows);
  const railNames = rails.map((b) => b.name);

  // The database holds the live half of the desk. If it cannot be read the
  // desk still shows verified events, and says the rest is missing.
  const registrants = registrantsOn(new Set(railNames));
  let leads: Lead[] | null = null;
  let fresh: Awaited<ReturnType<typeof railFreshness>> | null = null;
  let filings: Filing[] = [];
  // Site-wide, not per rail: a reader should know how far behind the reading is.
  const queue = await reviewQueue().catch(() => null);
  try {
    [leads, fresh] = await Promise.all([
      leadsFor(railNames, settings.leadMaxAgeDays),
      railFreshness(railNames, settings.staleAfterHours),
    ]);
  } catch {
    leads = null;
  }
  try {
    filings = await filingsFor([...registrants.keys()], settings.leadMaxAgeDays);
  } catch {
    // Table not provisioned yet, or the database is down: no filings, said below.
    filings = [];
  }
  let science: StoredItem[] = [];
  try {
    science = await newItems(railNames, 200, settings.leadMaxAgeDays, null);
  } catch {
    science = [];
  }
  const willSweep = Boolean(settings.sweepOnOpen && fresh && fresh.stale > 0);
  if (willSweep) {
    // After the response, never before it: the first paint must not wait on the web.
    after(() =>
      sweepStaleNow(railNames, { cooldownHours: settings.staleAfterHours }).catch(() => undefined),
    );
  }

  const railSet = new Set(railNames);
  const coNames = new Set(
    MARKET_PARTICIPANTS.filter((p) => follows.companies.includes(p.slug)).map((p) => p.name),
  );
  const events = EVENTS.filter(
    (e) => e.bottlenecks.some((b) => railSet.has(b)) || e.participants.some((p) => coNames.has(p)),
  );
  const feed = [
    ...buildFeed(events, leads ?? [], now, settings.leadMaxAgeDays, settings.strictLeads),
    ...filingItems(filings, registrants),
    ...scienceItems(science),
    ...seriesItems((await allSeries()).series, new Map(rails.map((b) => [b.slug, b.name]))),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const query = parseDeskQuery(params, settings, rails);
  const counts = Object.fromEntries(
    VIEWS.map((v) => [v, applyFilter(feed, { ...query.base, view: v }, marks, now).length]),
  ) as Record<View, number>;
  const visible = applyFilter(feed, { ...query.base, view: query.view }, marks, now);
  const limit = Math.min(Math.max(Number(params.n) || settings.pageSize, settings.pageSize), 300);
  const shown = visible.slice(0, limit);

  const byName = new Map(rails.map((b) => [b.name, b]));
  const railHref = (name: string) => {
    const b = byName.get(name);
    return b ? query.href({ rail: b.slug }) : bottleneckHref(name);
  };
  // Busiest rails ignore the view and the rail filter: a read row still shows a rail moved.
  const moved = railActivity(
    applyFilter(feed, { ...query.base, bottlenecks: [], view: 'all' }, marks, now),
  ).slice(0, 4);
  const binding = rails
    .filter((b) => b.horizon === 'now')
    .sort((a, b) => b.binding - a.binding)
    .slice(0, 8);
  const checked = params.checked !== undefined ? Number(params.checked) : null;
  const reviewer = isReviewer(actorId);

  return (
    <Shell currentPath="account">
      <Page>
        <DeskHeader
          firstName={session.user?.name?.split(' ')[0]}
          unread={counts.unread}
          window={query.window}
          unreadHref={query.href({ view: 'unread' })}
          fresh={
            fresh && {
              lastSwept: fresh.lastSwept,
              sweeping: fresh.sweeping > 0 || willSweep,
            }
          }
          railCount={rails.length}
          mutedCount={follows.muted.length}
          now={now}
          queue={
            queue && {
              waiting: queue.waiting,
              oldest: queue.oldestFoundAt ? ageLabel(queue.oldestFoundAt, now) : null,
              draftsReady: queue.draftsReady,
            }
          }
        />

        {checked !== null && (
          <p role="status" className="desk-notice">
            {checked === 0
              ? 'Every rail on your desk was checked within the last hour — nothing to re-check yet.'
              : `Checked ${checked} rail${checked === 1 ? '' : 's'}: ${Number(params.found) || 0} new lead${Number(params.found) === 1 ? '' : 's'}${Number(params.blind) > 0 ? `, ${params.blind} could not be reached` : ''}.`}
          </p>
        )}

        <MovedStrip moved={moved} window={query.window} byName={byName} railHref={railHref} />

        <div className="desk-layout">
          <section aria-labelledby="feed-heading" className="min-w-0">
            <h2 id="feed-heading" className="sr-only">
              News on your rails
            </h2>
            <FeedControls
              query={query}
              counts={counts}
              rails={rails}
              shown={shown.length}
              total={visible.length}
            />

            {shown.length === 0 ? (
              <div className="desk-empty">
                {query.view === 'unread' ? (
                  <p>
                    Nothing unread here.{' '}
                    <Link href={query.href({ view: 'all' })}>See everything</Link> or widen the time
                    window.
                  </p>
                ) : query.view === 'saved' ? (
                  <p>Nothing saved yet. Use ☆ Save on an item to keep it here.</p>
                ) : query.view === 'hidden' ? (
                  <p>Nothing hidden.</p>
                ) : (
                  <p>Nothing matches these filters.</p>
                )}
              </div>
            ) : (
              group(shown, query.grouping, now, railHref).map((g) => (
                <div key={g.label} className="desk-bucket">
                  <h3 className="desk-bucket-label">
                    {g.href ? <Link href={g.href}>{g.label}</Link> : g.label}
                  </h3>
                  <ul>
                    {g.items.map((item) => {
                      const key = itemKey(item);
                      return (
                        <FeedItem
                          key={key}
                          item={item}
                          now={now}
                          state={{
                            read: isRead(item, marks, settings.readUntil),
                            saved: marks.saved.has(key),
                            hidden: marks.hidden.has(key),
                          }}
                          reviewer={reviewer}
                          railHref={railHref}
                        />
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
            {visible.length > shown.length && (
              <p className="mt-6">
                <Link
                  href={`${query.href({})}${query.href({}).includes('?') ? '&' : '?'}n=${limit + settings.pageSize}`}
                  className="research-button-ghost"
                  scroll={false}
                >
                  Show {Math.min(settings.pageSize, visible.length - shown.length)} more
                </Link>
              </p>
            )}
          </section>

          <DeskAside
            binding={binding}
            railCount={rails.length}
            settings={settings}
            reviewer={reviewer}
          />
        </div>
      </Page>
    </Shell>
  );
}
