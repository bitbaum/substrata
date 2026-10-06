import { SignInError } from '@bitbaum/accountkit';
import { Page, Shell } from '@/components/portal/Shell';
import { authEnabled, signIn } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign-in did not finish', robots: { index: false } };

/**
 * Where Auth.js sends a sign-in that did not finish — it used to be Auth.js's
 * bare "Error" page. Try again starts the sign-in again; the provider's error
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
    await signIn('orangecat', { redirectTo: '/account' });
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
