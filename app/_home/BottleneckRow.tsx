import Link from 'next/link';

import type { Bottleneck } from '@/lib/bottlenecks';
import { bottleneckHref } from '@/lib/links';
import { SeverityBar, Status, rowLabel } from '@/components/portal/Status';

/**
 * One row of "worst right now", and the only way one is drawn. Two columns at
 * every width: the name and one plain line on the left, a fixed-width column
 * on the right holding the severity meter, the evidence word and — when an
 * event in the window moved it — one word saying which way. Nothing wraps
 * under anything else, so a long name cannot push the meter to a second line
 * on one row and leave it beside the title on the next.
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
      <div className="board-row-main">
        <Link href={bottleneckHref(b.slug)} className="board-row-name link-target">
          {b.name}
        </Link>
        <p className="board-row-plain">{b.plain}</p>
      </div>
      <div className="board-row-gauge">
        <SeverityBar value={b.binding} target />
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
