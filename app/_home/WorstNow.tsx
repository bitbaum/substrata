import Link from 'next/link';

import type { Bottleneck } from '@/lib/bottlenecks';
import { WHEN_LABEL } from '@/lib/labels';
import { Heading } from '@/components/portal/Shell';
import { SeverityBar, Status, rowLabel } from '@/components/portal/Status';
import { bottleneckHref } from '@/lib/links';
import { methodHref } from '@/lib/methods';

/**
 * Section 02: the most binding constraints now, flagged where an event in the
 * window moved them.
 */
export function WorstNow({
  worst,
  bindingNow,
  tightening,
  loosening,
}: {
  worst: Bottleneck[];
  bindingNow: number;
  tightening: Set<string>;
  loosening: Set<string>;
}) {
  return (
    <section>
      <Heading
        index="02"
        title="Worst right now"
        aside={
          <Link
            href="/bottlenecks?horizon=now"
            className="underline-offset-4 hover:text-fg-primary hover:underline"
          >
            All {bindingNow} →
          </Link>
        }
      />
      <ol className="divide-y divide-subtle border-y border-subtle">
        {worst.map((b) => (
          <li key={b.slug} className="py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <Link
                href={bottleneckHref(b.slug)}
                className="font-medium text-fg-primary underline-offset-4 hover:underline"
              >
                {b.name}
              </Link>
              <span className="flex items-center gap-4">
                <SeverityBar value={b.binding} />
                <Status state={b.state} compact label={rowLabel(b.counts)} />
              </span>
            </div>
            <p className="mt-0.5 max-w-prose text-xs leading-snug text-fg-tertiary">
              {b.plain}
              {tightening.has(b.name) && (
                <span className="ml-2 font-mono uppercase tracking-caps text-status-negative">
                  got worse
                </span>
              )}
              {loosening.has(b.name) && (
                <span className="ml-2 font-mono uppercase tracking-caps text-status-positive">
                  eased
                </span>
              )}
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-3 font-mono text-xs text-fg-muted">
        {WHEN_LABEL.now} · ranked by{' '}
        <Link href={methodHref('severity')} className="underline underline-offset-2">
          severity
        </Link>{' '}
        · judged {worst[0]?.judgedOn}
      </p>
    </section>
  );
}
