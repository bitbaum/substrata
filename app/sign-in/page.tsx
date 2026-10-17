import { redirect } from 'next/navigation';
import { authLabelsFor, signInMethods } from '@bitbaum/accountkit/auth';
import { returnPath } from '@bitbaum/accountkit/orangecat';
import { SubstrataSignIn } from '@/components/portal/AccountScreens';
import { Page, SectionHeader, Shell } from '@/components/portal/Shell';
import { authEnabled, currentSession, signInHref } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in', robots: { index: false } };

/** Every way in, on one screen. No OrangeCat account is needed. */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const query = await searchParams;
  const next = returnPath(query.next, '/account');
  if (await currentSession()) redirect(next);
  const labels = authLabelsFor('en');
  return (
    <Shell>
      <Page>
        <SectionHeader
          title={labels.signIn}
          lede="An account keeps your research desk: the bottlenecks you follow and what moved on them. The research itself needs none."
        />
        <div className="max-w-md">
          {authEnabled ? (
            <SubstrataSignIn
              labels={labels}
              methods={signInMethods(process.env, false)}
              next={next}
              signUpHref={signInHref(next, 'sign-up')}
              initialError={Boolean(query.error)}
            />
          ) : (
            <p>{labels.errors.unavailable}</p>
          )}
        </div>
      </Page>
    </Shell>
  );
}
