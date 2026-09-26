'use client';

import { useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/**
 * A GET form that applies itself: a select or a checkbox takes effect on
 * change, a text box after a pause in typing. Without JavaScript it is an
 * ordinary form with an Apply button, so nothing depends on this.
 */
export function AutoSubmitForm({
  action,
  className,
  children,
}: {
  action: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const timer = useRef<number | undefined>(undefined);
  // The one loading state for filter bars: the results stay, dimmed, until the new ones arrive.
  const [pending, startTransition] = useTransition();

  function apply(form: HTMLFormElement) {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === 'string' && value !== '') params.append(key, value);
    }
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${action}?${qs}` : action, { scroll: false }));
  }

  return (
    <form
      action={action}
      method="get"
      className={className}
      data-pending={pending || undefined}
      aria-busy={pending || undefined}
      onChange={(event) => {
        const form = event.currentTarget;
        const target = event.target as unknown as HTMLInputElement;
        window.clearTimeout(timer.current);
        if (target.type === 'search' || target.type === 'text') {
          timer.current = window.setTimeout(() => apply(form), 350);
        } else {
          apply(form);
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();
        apply(event.currentTarget);
      }}
    >
      {children}
      <span role="status" className="filter-pending">
        {pending ? 'Updating…' : ''}
      </span>
    </form>
  );
}
