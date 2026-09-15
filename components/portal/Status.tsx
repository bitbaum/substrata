/**
 * The one visual vocabulary the portal has: a dot and a word for how well a
 * row is evidenced. Green means a person checked it. Amber means a machine
 * found something and nobody has read it. Grey means neither.
 *
 * The words come from `lib/labels.ts`, not from the data model, because the
 * data model's names are for the code and these are for a reader.
 */

import React from 'react';
import type { Verification } from '@/config/substrata-evidence';
import { EVIDENCE_LABEL, EVIDENCE_SHORT } from '@/lib/labels';

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
  /** Overrides the word, keeps the dot — "6 of 7 verified" on a partly verified row. */
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-fg-secondary">
      <span
        aria-hidden
        className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${DOT[state]}`}
      />
      {label ?? (compact ? EVIDENCE_SHORT[state] : EVIDENCE_LABEL[state])}
    </span>
  );
}

/** A node whose producers are partly verified says how many, rather than picking one word. */
export function rowLabel(counts: {
  sourced: number;
  candidate: number;
  total: number;
}): string | undefined {
  if (counts.total > 1 && counts.sourced > 0 && counts.sourced < counts.total) {
    return `${counts.sourced} of ${counts.total} verified`;
  }
  return undefined;
}

/** Three counts as a tiny stacked bar: verified, source found, unverified. */
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
      aria-label={`${sourced} verified, ${candidate} with a source found, ${total - sourced - candidate} unverified, of ${total}`}
    >
      <span className="bg-status-positive" style={{ width: pct(sourced) }} />
      <span className="bg-status-warning" style={{ width: pct(candidate) }} />
    </span>
  );
}

/** 0–12 severity as a number and a short bar. */
export function SeverityBar({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono text-xs tabular-nums text-fg-primary">{value}</span>
      <span
        className="flex h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-border-subtle"
        aria-hidden
      >
        <span className="bg-accent" style={{ width: `${(value / 12) * 100}%` }} />
      </span>
    </span>
  );
}
