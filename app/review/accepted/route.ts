import { auth, isReviewer } from '@/lib/auth';
import { acceptedAwaitingCommit } from '@/lib/event-draft-store';

export const dynamic = 'force-dynamic';

/**
 * The accepted events not yet in the corpus file, as the JSON
 * `pnpm run research:accept-events <file>` reads. Reviewer-only, like /review.
 *
 * This is the hand-off from the database to git: the box has no checkout and
 * no token to commit with, so a person carries these rows into a commit.
 */
export async function GET() {
  const session = await auth();
  if (!isReviewer(session?.actorId)) return new Response('Not found', { status: 404 });
  const events = await acceptedAwaitingCommit();
  return new Response(`${JSON.stringify(events, null, 2)}\n`, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="accepted-events-${new Date().toISOString().slice(0, 10)}.json"`,
      'cache-control': 'no-store',
    },
  });
}
