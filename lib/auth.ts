import NextAuth from 'next-auth';
import { hasAuthenticatedSubject } from './identity';

/** Same identity-only OIDC contract as Solon; OrangeCat owns credentials. */
export const authEnabled = Boolean(
  process.env.ORANGECAT_OAUTH_CLIENT_ID && process.env.ORANGECAT_OAUTH_CLIENT_SECRET,
);
const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  providers: authEnabled
    ? [
        {
          id: 'orangecat',
          name: 'OrangeCat',
          type: 'oidc',
          issuer: 'https://orangecat.ch',
          clientId: process.env.ORANGECAT_OAUTH_CLIENT_ID,
          clientSecret: process.env.ORANGECAT_OAUTH_CLIENT_SECRET,
          client: { token_endpoint_auth_method: 'client_secret_post' },
          checks: ['pkce', 'state'],
          authorization: { params: { scope: 'openid profile email' } },
        },
      ]
    : [],
  callbacks: {
    signIn({ profile }) {
      // OrangeCat rejects anonymous accounts at its authorization boundary.
      // The signed OIDC subject owns preferences; optional profile email can
      // be null even when the underlying account is authenticated.
      return hasAuthenticatedSubject(profile);
    },
    jwt({ token, profile }) {
      if (profile?.sub) token.actorId = profile.sub;
      return token;
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

export async function currentSession() {
  if (!authSecret) return null;
  try {
    return await auth();
  } catch {
    return null;
  }
}
