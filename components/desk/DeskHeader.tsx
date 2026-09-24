import Link from 'next/link';

import { whenLabel } from '@/lib/desk';
import { WINDOW_LABEL, type Window } from '@/lib/follows';
import { DeskRefresh } from '@/components/portal/DeskRefresh';
import { checkNow, markAllRead } from '@/app/account/actions';
import { methodHref } from '@/lib/methods';

export interface Freshness {
  lastSwept: string | null;
  sweeping: boolean;
}

/** The review queue behind the leads: how much is unread by any person, and for how long. */
export interface QueueLine {
  waiting: number;
  oldestDays: number | null;
  draftsReady: number;
}

export function DeskHeader({
  firstName,
  unread,
  window,
  unreadHref,
  fresh,
  railCount,
  mutedCount,
  now,
  queue = null,
}: {
  firstName?: string;
  /** Unread rows in the current window and sources — the same number as the Unread tab. */
  unread: number;
  window: Window;
  unreadHref: string;
  fresh: Freshness | null;
  railCount: number;
  mutedCount: number;
  now: Date;
  queue?: QueueLine | null;
}) {
  return (
    <header className="desk-hero">
      <div className="min-w-0">
        <p className="desk-kicker">Desk{firstName ? ` · ${firstName}` : ''}</p>
        <h1 className="desk-title">
          {unread > 0 ? (
            <Link href={unreadHref}>
              {unread} unread
              <span className="desk-title-sub">
                {window === 'all' ? ' in total' : ` in the last ${WINDOW_LABEL[window]}`}
              </span>
            </Link>
          ) : (
            'You are up to date.'
          )}
        </h1>
        <p className="desk-status">
          {fresh === null ? (
            <>Web leads are unavailable right now — showing verified events only.</>
          ) : fresh.lastSwept === null ? (
            <>The sweep has not looked at your rails yet.</>
          ) : (
            <Link href="/account/settings#sweep" title="Per-rail sweep status and settings">
              Web last checked {whenLabel(fresh.lastSwept, now)}
              {fresh.sweeping && ' · checking stale rails now'}
            </Link>
          )}
          {' · '}
          <Link href="/account/settings#rails" title="Choose which bottlenecks are on your desk">
            {railCount} rail{railCount === 1 ? '' : 's'} on your desk
          </Link>
          {queue && queue.waiting > 0 && (
            <>
              {' · '}
              <Link href={methodHref('review-queue')} title="How the review queue is counted">
                {queue.waiting} web lead{queue.waiting === 1 ? '' : 's'} awaiting review
                {queue.oldestDays !== null && `, oldest ${queue.oldestDays}d`}
                {queue.draftsReady > 0 && `, ${queue.draftsReady} drafted`}
              </Link>
            </>
          )}
          {mutedCount > 0 && (
            <>
              {' · '}
              <Link href="/account/settings#rails">{mutedCount} muted</Link>
            </>
          )}
        </p>
      </div>
      <div className="desk-hero-actions">
        <DeskRefresh action={checkNow} sweeping={Boolean(fresh?.sweeping)} />
        {unread > 0 && (
          <form action={markAllRead}>
            <button
              type="submit"
              className="research-button-ghost"
              title="Everything up to now counts as read"
            >
              Mark all read
            </button>
          </form>
        )}
        <Link href="/account/settings" className="research-button-ghost">
          Settings
        </Link>
      </div>
    </header>
  );
}
