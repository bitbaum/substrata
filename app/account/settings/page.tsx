import Link from 'next/link';
import { redirect } from 'next/navigation';

import { currentSession, isReviewer, signOut } from '@/lib/auth';
import { MARKET_PARTICIPANTS } from '@/lib/participants';
import { Page, Shell } from '@/components/portal/Shell';
import { PageHeader } from '@/components/portal/PageHeader';
import { RailsSettings } from '@/components/desk/settings/RailsSettings';
import { FeedSettings } from '@/components/desk/settings/FeedSettings';
import { SweepSettings } from '@/components/desk/settings/SweepSettings';
import { AiSettings } from '@/components/desk/settings/AiSettings';
import { AutoUpdates } from '@/components/desk/settings/AutoUpdates';
import { storedKey, vaultEnabled } from '@/lib/byok-vault';
import { railsOf } from '@/lib/follows';
import { readFollows } from '@/lib/desk-store';
import { DEFAULT_SWEEP_SETTINGS } from '@/lib/sweep';
import { sweepSettings } from '@/lib/sweep-store';
import { nodeStatuses, type NodeStatus } from '@/lib/sweep-queue';
import { saveSettings } from '../actions';

export const dynamic = 'force-dynamic';

const SAVED: Record<string, string> = {
  '1': 'Settings saved.',
  sweep: 'Sweep settings saved.',
  auto: 'Automatic AI updates saved.',
  'need-key':
    'Automatic updates need a key saved on your account — add one under AI, then switch them on.',
};
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
  const stored = await storedKey(actorId).catch(() => null);
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
    <Shell>
      <Page>
        <PageHeader
          kicker={
            <>
              <Link href="/account">Desk</Link> · Settings
            </>
          }
          title="Make the desk yours."
          status="What reaches your desk, how it is shown, and how often the web is checked."
          actions={<Link href="/account">← Back to desk</Link>}
        />
        {saved && (
          <p role="status" className="desk-notice">
            {SAVED[saved] ?? SAVED['1']}
          </p>
        )}

        <nav aria-label="Settings sections" className="desk-views mb-8">
          <a href="#rails">Bottlenecks</a>
          <a href="#feed">Feed</a>
          <a href="#sweep">Sweep</a>
          <a href="#ai">AI</a>
          <a href="#auto-updates">Automatic updates</a>
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

        <AutoUpdates desk={follows.desk} stored={stored} vaultOn={vaultEnabled()} />

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
