import Link from 'next/link';

import type { WorstNow as Board } from '@/lib/worst-now';
import { WHEN_LABEL } from '@/lib/labels';
import { methodHref } from '@/lib/methods';
import { Heading } from '@/components/portal/Shell';
import { BottleneckRow } from './BottleneckRow';

/**
 * The most binding constraints now, flagged where an event in the window moved
 * them. Used by the front page and by the industry view, which share the rows.
 */
export function WorstNow({
  worst,
  bindingNow,
  tightening,
  loosening,
  bare = false,
}: Board & {
  bindingNow: number;
  /** Without its own heading, inside a page section that already has one. */
  bare?: boolean;
}) {
  return (
    <section className="home-section">
      {!bare && (
        <Heading
          title="Worst right now"
          aside={
            <Link href="/bottlenecks?horizon=now" className="home-more">
              All {bindingNow} →
            </Link>
          }
        />
      )}
      <ol className="board-rows">
        {worst.map((b) => (
          <BottleneckRow
            key={b.slug}
            bottleneck={b}
            moved={tightening.has(b.name) ? 'worse' : loosening.has(b.name) ? 'eased' : undefined}
          />
        ))}
      </ol>
      <p className="board-note">
        {WHEN_LABEL.now} · ranked by{' '}
        <Link href={methodHref('severity')} className="link-target underline underline-offset-2">
          severity
        </Link>{' '}
        · judged <span className="whitespace-nowrap">{worst[0]?.judgedOn}</span>
      </p>
    </section>
  );
}
