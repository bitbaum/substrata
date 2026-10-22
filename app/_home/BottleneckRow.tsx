import Link from 'next/link';

import type { Bottleneck } from '@/lib/bottlenecks';
import { bottleneckHref } from '@/lib/links';
import { SeverityBar, Status, rowLabel } from '@/components/portal/Status';

/**
 * One row of "worst right now", and the only way one is drawn. A grid of
 * two columns and two lines at every width: the name and the severity meter on
 * the first line, the plain sentence and the evidence word (with, when an event
 * in the window moved it, one word saying which way) on the second. The right
 * column is fixed, so each value sits on the baseline of the text it belongs
 * to, and a long name cannot push the meter to a second line on one row and
 * leave it beside the title on the next.
 */
export function BottleneckRow({
  bottleneck: b,
  moved,
}: {
  bottleneck: Bottleneck;
  moved?: 'worse' | 'eased';
}) {
  return (
    <li className="board-row">
      <Link href={bottleneckHref(b.slug)} className="board-row-name link-target">
        {b.name}
      </Link>
      <div className="board-row-meter">
        <SeverityBar value={b.binding} target />
      </div>
      <p className="board-row-plain">{b.plain}</p>
      <div className="board-row-status">
        <Status state={b.state} compact label={rowLabel(b.counts)} />
        {moved && (
          <span className={`board-row-moved is-${moved}`}>
            {moved === 'worse' ? 'got worse' : 'eased'}
          </span>
        )}
      </div>
    </li>
  );
}
