import NextAuth from 'next-auth';

/** Same identity-only OIDC contract as Solon; OrangeCat owns credentials. */
export const authEnabled = Boolean(
  process.env.ORANGECAT_OAUTH_CLIENT_ID && process.env.ORANGECAT_OAUTH_CLIENT_SECRET,
);
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
      return Boolean(profile?.sub && profile?.email && profile.email_verified !== false);
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
