import NextAuth from 'next-auth';
import { orangecatClient, orangecatProvider, syncOcSession } from '@bitbaum/accountkit/orangecat';
import { hasAuthenticatedSubject } from './identity';

/**
 * Sign in with OrangeCat — identity only, the same contract as every bitbaum
 * app: the provider and the session refresh are @bitbaum/accountkit/orangecat.
 * The session lives only as long as OrangeCat lets it: once the access token
 * expires it refreshes, and a refusal (Disconnect on OrangeCat, Sign out
 * everywhere, account deleted) drops `actorId`, which is how every page reads
 * "signed out".
 */
const orangecat = orangecatClient();
export const authEnabled = orangecat !== null;
const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { error: '/account/sign-in-error' },
  providers: orangecat ? [orangecatProvider(orangecat)] : [],
  callbacks: {
    signIn({ profile }) {
      // OrangeCat rejects anonymous accounts at its authorization boundary.
      // The signed OIDC subject owns preferences; optional profile email can
      // be null even when the underlying account is authenticated.
      return hasAuthenticatedSubject(profile);
    },
    jwt({ token, profile, account }) {
      return syncOcSession({ token, profile, account }, orangecat);
    },
    session({ session, token }) {
      if (typeof token.actorId === 'string') session.actorId = token.actorId;
      return session;
    },
  },
});
declare module 'next-auth' {
  interface Session {
    actorId?: string;
  }
}
export function isReviewer(actorId: string | undefined) {
  return !!actorId && (process.env.SUBSTRATA_REVIEWER_ACTOR_IDS ?? '').split(',').includes(actorId);
}

/**
 * The session, or null when signed out. Without a secret there is no session
 * to read. A failure to read one still answers "signed out" — the research is
 * public, so a broken session must not take a page down — but it is LOGGED:
 * this used to swallow every error, so a misconfigured secret or a broken
 * cookie looked exactly like nobody being signed in.
 */
export async function currentSession() {
  if (!authSecret) return null;
  try {
    return await auth();
  } catch (error) {
    console.error(
      'session read failed',
      error instanceof Error ? `${error.name}: ${error.message}` : 'unknown',
    );
    return null;
  }
}
