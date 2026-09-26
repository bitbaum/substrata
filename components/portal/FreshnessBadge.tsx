'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { STATE_LABEL, type FreshState } from '@/lib/freshness/status';

interface Summary {
  state: FreshState;
  attention: string[];
}

/**
 * The footer's one-line answer to "is this current?", read from
 * /api/health/freshness after the page loads so a cached page never shows a
 * cached verdict. Before the answer arrives it is a plain link.
 */
export function FreshnessBadge() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health/freshness', { signal: controller.signal })
      .then((r) => r.json())
      .then((body: Summary) => setSummary({ state: body.state, attention: body.attention ?? [] }))
      .catch(() => setSummary({ state: 'unknown', attention: [] }));
    return () => controller.abort();
  }, []);

  const words =
    summary === null
      ? 'Data freshness'
      : summary.attention.length === 0
        ? 'All feeds and data fresh'
        : `${STATE_LABEL[summary.state]}: ${summary.attention.length} need${summary.attention.length === 1 ? 's' : ''} attention`;

  return (
    <span className="fresh-footer-row">
      <Link
        href="/data/freshness"
        className={`fresh-footer fresh-badge is-${summary?.state ?? 'pending'}`}
        title={summary?.attention.join(' · ') || undefined}
      >
        <span aria-hidden="true" className="fresh-dot" />
        {words}
      </Link>
      <Link href="/data/quality" className="fresh-footer fresh-badge">
        Data quality →
      </Link>
    </span>
  );
}
