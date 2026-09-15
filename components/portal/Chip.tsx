/**
 * A filter chip that is a link. Active state is the accent fill; the count
 * is what the board would show if you clicked it.
 */

import React from 'react';
import Link from 'next/link';

interface Props {
  href: string;
  active: boolean;
  label: string;
  count?: number;
}

export function Chip({ href, active, label, count }: Props) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={[
        'inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm transition-colors',
        active
          ? 'border-accent bg-accent text-surface-page'
          : 'border-strong text-fg-secondary hover:border-accent hover:text-fg-primary',
      ].join(' ')}
    >
      {label}
      {count !== undefined && (
        <span
          className={`font-mono text-xs tabular-nums ${active ? 'opacity-80' : 'text-fg-muted'}`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
