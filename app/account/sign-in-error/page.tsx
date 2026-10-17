import { SignInError } from '@bitbaum/accountkit';
import { Page, Shell } from '@/components/portal/Shell';
import { authEnabled, signIn } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign-in did not finish', robots: { index: false } };

/**
 * A sign-in that did not finish, for links that still arrive here. Try again
 * opens the sign-in screen, which offers every way in; the provider's error
 * code is never shown.
 */
export default async function SignInErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function retry() {
    'use server';
    await signIn({ redirectTo: '/account' });
  }

  return (
    <Shell>
      <Page>
        <SignInError
          error={authEnabled ? error : 'Configuration'}
          retry={retry}
          home="/"
          labels={{ kicker: 'Your research desk' }}
        />
      </Page>
    </Shell>
  );
}
