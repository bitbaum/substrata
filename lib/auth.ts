import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { drizzle } from 'drizzle-orm/node-postgres';
import { authSchema } from '@bitbaum/accountkit/auth/schema';
import { isDeliverable } from '@bitbaum/accountkit/auth';
import { createAuthRuntime } from '@bitbaum/accountkit/auth/next';
import { accountsDatabase } from './db';
import { within } from './within';

/** How long a page waits for a session before treating the reader as signed out. */
export const SESSION_READ_TIMEOUT_MS = 4000;
import { SITE } from './site';
import { signInHref } from './sign-in-href';

export { signInHref };

/**
 * Accounts on Substrata — the fleet's one account system
 * (@bitbaum/accountkit/auth). A reader signs up with an email and a password,
 * a passkey, or "Continue with OrangeCat"; OrangeCat is one way in, never a
 * requirement. The tables are scripts/db/017-accounts.sql.
 *
 * Desks, follows, saved AI keys and reviewer ids were keyed on the OrangeCat
 * actor id before Substrata had accounts. `legacyIdentityProvider` keeps that
 * id for everyone whose first way in was OrangeCat, so all of it stays theirs
 * with no data migration (SUBSTRATA_REVIEWER_ACTOR_IDS included). Everyone
 * else is their account id.
 */
export const { GET, POST, getSession, authStatus, getAuth } = createAuthRuntime({
  site: { url: SITE.url, title: SITE.name, slug: 'substrata' },
  // Substrata sends no mail yet: the sign-in link and address confirmation
  // stay hidden, and a password account signs in at once.
  mail: { configured: false, send: async () => {} },
  isDatabaseConfigured: () => Boolean(process.env.DATABASE_URL),
  getDatabase: () => drizzle(accountsDatabase(), { schema: authSchema }),
  legacyIdentityProvider: 'orangecat',
});

/** False without a database or a session secret: sign-in is then not offered. */
export const authEnabled = authStatus().ready;

export interface SubstrataSession {
  /** The id every desk, follow and saved key uses (see above). */
  actorId: string;
  user: { name: string | null; email: string | null; image: string | null };
}

export function isReviewer(actorId: string | undefined) {
  return !!actorId && (process.env.SUBSTRATA_REVIEWER_ACTOR_IDS ?? '').split(',').includes(actorId);
}

/** The signed-in reader, or null. */
export async function auth(): Promise<SubstrataSession | null> {
  const session = await getSession();
  if (!session) return null;
  const { user } = session;
  return {
    actorId: user.actorId,
    user: {
      name: user.name || null,
      email: isDeliverable(user.email) ? user.email : null,
      image: user.image ?? null,
    },
  };
}

/**
 * The session, or null when signed out. A failure to read one still answers
 * "signed out" — the research is public, so a broken session must not take a
 * page down — but it is LOGGED, so a misconfigured secret or a missing table
 * does not look exactly like nobody being signed in.
 */
export async function currentSession(): Promise<SubstrataSession | null> {
  if (!authEnabled) return null;
  try {
    // A session read that does not answer is "signed out" after a few seconds,
    // not a page that hangs. On 2026-10-30 every page 502'd for hours while
    // session reads hung and /api/health still answered; a restart cleared it.
    return await within(auth(), SESSION_READ_TIMEOUT_MS, 'session read');
  } catch (error) {
    console.error(
      'session read failed',
      error instanceof Error ? `${error.name}: ${error.message}` : 'unknown',
    );
    return null;
  }
}

/** Send the reader to the sign-in screen, which offers every way in. */
export async function signIn(options: { redirectTo: string }): Promise<never> {
  redirect(signInHref(options.redirectTo));
}

/** End the session and go where the caller asked. */
export async function signOut(options: { redirectTo: string }): Promise<never> {
  try {
    await getAuth().api.signOut({ headers: await headers() });
  } catch {
    // Already signed out, or accounts unavailable: either way, go on.
  }
  redirect(options.redirectTo);
}
