import { redirect } from 'next/navigation';
import { authLabelsFor, signInMethods } from '@bitbaum/accountkit/auth';
import { returnPath } from '@bitbaum/accountkit/orangecat';
import { SubstrataSignUp } from '@/components/portal/AccountScreens';
import { Page, SectionHeader, Shell } from '@/components/portal/Shell';
import { authEnabled, currentSession, mailConfigured, signInHref } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Create an account', robots: { index: false } };

/** A Substrata account, with no other account behind it. */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = returnPath((await searchParams).next, '/account');
  if (await currentSession()) redirect(next);
  const labels = authLabelsFor('en');
  return (
    <Shell>
      <Page>
        <SectionHeader
          title={labels.createAccount}
          lede="Follow bottlenecks and companies, and keep a desk of what moved on them."
        />
        <div className="max-w-md">
          {authEnabled ? (
            <SubstrataSignUp
              labels={labels}
              methods={signInMethods(process.env, mailConfigured())}
              next={next}
              signInHref={signInHref(next)}
            />
          ) : (
            <p>{labels.errors.unavailable}</p>
          )}
        </div>
      </Page>
    </Shell>
  );
}
