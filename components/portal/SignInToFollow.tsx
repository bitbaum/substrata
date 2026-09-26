import { authEnabled, signIn } from '@/lib/auth';

/**
 * The follow action a signed-out reader sees. Before this, the follow buttons
 * simply did not render without a session, so nothing on a bottleneck page
 * said it could be followed at all. Signing in returns to the same page.
 */
export function SignInToFollow({ returnTo, what }: { returnTo: string; what: string }) {
  if (!authEnabled) return null;
  return (
    <form
      className="follow-wrap"
      action={async () => {
        'use server';
        await signIn('orangecat', { redirectTo: returnTo });
      }}
    >
      <button className="follow-btn">Follow {what} on my desk</button>
      <span className="follow-hint">
        Sign in with OrangeCat to follow; you come back to this page.
      </span>
    </form>
  );
}
