import { authEnabled, currentSession, isReviewer } from '@/lib/auth';
import { AccountMenuView, type Reader } from './AccountMenuView';

/** The account menu for a page rendered per request: the session is read here. */
export async function AccountMenu() {
  const session = await currentSession();
  return <AccountMenuView reader={readerFrom(session)} />;
}

/** One reading of the session, shared with /api/me so the two cannot disagree. */
export function readerFrom(session: Awaited<ReturnType<typeof currentSession>>): Reader {
  return {
    signedIn: Boolean(session?.actorId),
    name: session?.user?.name ?? session?.user?.email ?? null,
    image: session?.user?.image ?? null,
    reviewer: isReviewer(session?.actorId),
    authEnabled,
  };
}
