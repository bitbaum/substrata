'use client';

import { useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';

function Button() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="desk-refresh" disabled={pending} aria-live="polite">
      <span className={pending ? 'desk-refresh-icon is-spinning' : 'desk-refresh-icon'} aria-hidden>
        ↻
      </span>
      {pending ? 'Checking the web…' : 'Check for news now'}
    </button>
  );
}

/**
 * "Check now", and the quiet reload after a background sweep.
 *
 * Opening the desk starts a sweep of stale rails after the response is sent,
 * so the first paint is never held up by the web. While one is running the
 * page says so and reloads itself once, a minute later, to pick up what it
 * found — the reader does not have to know a sweep exists.
 */
export function DeskRefresh({
  action,
  sweeping,
}: {
  action: () => Promise<void>;
  sweeping: boolean;
}) {
  const router = useRouter();
  useEffect(() => {
    if (!sweeping) return;
    const timer = window.setTimeout(() => router.refresh(), 60_000);
    return () => window.clearTimeout(timer);
  }, [sweeping, router]);

  return (
    <form action={action}>
      <Button />
    </form>
  );
}
