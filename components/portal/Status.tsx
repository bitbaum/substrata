/**
 * The one visual vocabulary the portal has: a dot and a word for the
 * verification state of a row. Green is a finding, amber is a lead an
 * analyst can act on, grey is neither. The same three words the API uses.
 */

import React from 'react';
import type { Verification } from '@/config/substrata-evidence';
import { STATE_LABEL } from '@/lib/bottlenecks';

const DOT: Record<Verification, string> = {
  sourced: 'bg-status-positive',
  candidate: 'bg-status-warning',
  unverified: 'bg-fg-muted',
};

export function Status({
  state,
  compact = false,
  label,
}: {
  state: Verification;
  compact?: boolean;
  /** Overrides the word, keeps the dot — "6/7 sourced" on a partly sourced row. */
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-fg-secondary">
      <span
        aria-hidden
        className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${DOT[state]}`}
      />
      {label ?? (compact ? STATE_LABEL[state].split(' ')[0] : STATE_LABEL[state])}
    </span>
  );
}

/** The row-level word: a node whose producers are partly sourced says how many, not "candidate". */
export function rowLabel(counts: {
  sourced: number;
  candidate: number;
  total: number;
}): string | undefined {
  if (counts.total > 1 && counts.sourced > 0 && counts.sourced < counts.total) {
    return `${counts.sourced}/${counts.total} sourced`;
  }
  return undefined;
}

/** Three counts as a tiny stacked bar: sourced, candidate, unverified. */
export function Progress({
  sourced,
  candidate,
  total,
}: {
  sourced: number;
  candidate: number;
  total: number;
}) {
  if (total === 0) return null;
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <span
      className="flex h-1.5 w-full max-w-24 overflow-hidden rounded-full bg-border-subtle"
      role="img"
      aria-label={`${sourced} sourced, ${candidate} candidate, ${total - sourced - candidate} unverified of ${total}`}
    >
      <span className="bg-status-positive" style={{ width: pct(sourced) }} />
      <span className="bg-status-warning" style={{ width: pct(candidate) }} />
    </span>
  );
}
