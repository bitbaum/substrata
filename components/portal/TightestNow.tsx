/**
 * The board's opening: the few constraints binding hardest today, each in one
 * plain sentence. A first-time reader should meet "one company on earth builds
 * them" before a 33-row table, because that sentence is what the table is for.
 */

import React from 'react';
import Link from 'next/link';

import { STAGES } from '@/config/substrata-stages';
import type { Bottleneck } from '@/lib/bottlenecks';
import { bottleneckHref } from '@/lib/links';
import { Figure } from './Figure';
import { SeverityBar, Status, rowLabel } from './Status';

export function TightestNow({ rows }: { rows: readonly Bottleneck[] }) {
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="tightest-now" className="mb-10">
      <h2
        id="tightest-now"
        className="font-heading text-xl font-semibold tracking-display text-fg-primary"
      >
        Tightest right now
      </h2>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-tertiary">
        Binding today, hardest first, and made by the fewest hands. Each one sets a ceiling on
        everything downstream of it.
      </p>
      <ol className="mt-4 grid gap-3 lg:grid-cols-3">
        {rows.map((row) => (
          <li key={row.slug}>
            <Link
              href={bottleneckHref(row.slug)}
              className="group flex h-full flex-col rounded-lg border border-subtle bg-surface-raised px-5 py-4 hover:border-strong"
            >
              <span className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                {STAGES.find((s) => s.id === row.stage)?.name}
              </span>
              <span className="mt-1 font-heading text-lg font-semibold leading-snug text-fg-primary underline-offset-4 group-hover:underline">
                {row.name}
              </span>
              <span className="mt-2 flex-1 text-base leading-relaxed text-fg-secondary">
                {row.plain}
              </span>
              <span className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-fg-tertiary">
                <SeverityBar value={row.binding} inLink />
                {row.counts.total > 0 && (
                  <span>
                    <Figure method="producer-rows" inLink>
                      {row.counts.total}
                    </Figure>{' '}
                    {row.counts.total === 1 ? 'maker' : 'makers'} mapped
                  </span>
                )}
                <Status state={row.state} compact label={rowLabel(row.counts)} />
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
