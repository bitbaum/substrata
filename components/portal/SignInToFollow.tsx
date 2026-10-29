import { authEnabled, signInHref } from '@/lib/auth';

/**
 * The follow action a signed-out reader sees. Before this, the follow buttons
 * simply did not render without a session, so nothing on a bottleneck page
 * said it could be followed at all. Signing in returns to the same page.
 */
export function SignInToFollow({ returnTo, what }: { returnTo: string; what: string }) {
  if (!authEnabled) return null;
  return (
    <div className="follow-wrap">
      <a href={signInHref(returnTo)} className="follow-btn inline-flex items-center">
        Follow {what} on my desk
      </a>
      <span className="follow-hint">
        Sign in or create an account to follow; you come back to this page.
      </span>
    </div>
  );
}
