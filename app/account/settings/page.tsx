import Link from 'next/link';
import { redirect } from 'next/navigation';

import { currentSession, isReviewer, signOut } from '@/lib/auth';
import { MARKET_PARTICIPANTS } from '@/lib/participants';
import { Page, Shell } from '@/components/portal/Shell';
import { RailsSettings } from '@/components/desk/settings/RailsSettings';
import { FeedSettings } from '@/components/desk/settings/FeedSettings';
import { SweepSettings } from '@/components/desk/settings/SweepSettings';
import { AiSettings } from '@/components/desk/settings/AiSettings';
import { railsOf } from '@/lib/follows';
import { readFollows } from '@/lib/desk-store';
import { DEFAULT_SWEEP_SETTINGS } from '@/lib/sweep';
import { sweepSettings } from '@/lib/sweep-store';
import { nodeStatuses, type NodeStatus } from '@/lib/sweep-queue';
import { saveSettings } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Desk settings' };

export default async function DeskSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await currentSession();
  if (!session?.actorId) redirect('/account');
  const { saved } = await searchParams;
  const now = new Date();
  const actorId = session.actorId;
  const reviewer = isReviewer(actorId);
  const follows = await readFollows(actorId);
  const rails = railsOf(follows);
  const onDesk = new Set(rails.map((b) => b.slug));
  const followedCo = MARKET_PARTICIPANTS.filter((p) => follows.companies.includes(p.slug));

  let statuses: NodeStatus[] | null = null;
  let sweep = { ...DEFAULT_SWEEP_SETTINGS };
  try {
    [statuses, sweep] = await Promise.all([
      nodeStatuses(rails.map((b) => b.name)),
      sweepSettings(),
    ]);
  } catch {
    statuses = null;
  }

  return (
    <Shell currentPath="account">
      <Page>
        <header className="desk-hero">
          <div>
            <p className="desk-kicker">
              <Link href="/account">Desk</Link> · Settings
            </p>
            <h1 className="desk-title">Make the desk yours.</h1>
            <p className="desk-status">
              What reaches your desk, how it is shown, and how often the web is checked.
            </p>
          </div>
          <Link href="/account" className="research-button-ghost">
            ← Back to desk
          </Link>
        </header>
        {saved && (
          <p role="status" className="desk-notice">
            {saved === 'sweep' ? 'Sweep settings saved.' : 'Settings saved.'}
          </p>
        )}

        <nav aria-label="Settings sections" className="desk-views mb-8">
          <a href="#rails">Bottlenecks</a>
          <a href="#feed">Feed</a>
          <a href="#sweep">Sweep</a>
          <a href="#ai">AI</a>
          <a href="#account">Account</a>
        </nav>

        <form action={saveSettings} className="settings-form">
          <RailsSettings
            follows={follows}
            onDesk={onDesk}
            railCount={rails.length}
            followedCo={followedCo}
          />
          <FeedSettings follows={follows} />

          <div className="settings-save">
            <button type="submit" className="research-button">
              Save settings
            </button>
            <Link href="/account" className="research-button-ghost">
              Cancel
            </Link>
          </div>
        </form>

        <SweepSettings sweep={sweep} statuses={statuses} reviewer={reviewer} now={now} />

        <AiSettings />

        <section id="account" className="settings-section">
          <div className="settings-head">
            <h2>Account</h2>
          </div>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/' });
            }}
          >
            <button type="submit" className="research-button-ghost">
              Sign out
            </button>
          </form>
        </section>
      </Page>
    </Shell>
  );
}
