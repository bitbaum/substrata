import Link from 'next/link';

import type { Bottleneck } from '@/lib/bottlenecks';
import type { RailActivity } from '@/lib/desk-filter';
import { WINDOW_LABEL, type Window } from '@/lib/follows';
import { BINDING_MAX, scoreParts } from './BindingScore';

/** The rails with the most items in the window: where to look first. */
export function MovedStrip({
  moved,
  window,
  byName,
  railHref,
}: {
  moved: RailActivity[];
  window: Window;
  byName: Map<string, Bottleneck>;
  railHref: (name: string) => string;
}) {
  if (moved.length === 0) return null;
  return (
    <section aria-labelledby="moved-heading" className="mb-8">
      <h2 id="moved-heading" className="desk-section-label">
        Busiest rails · {window === 'all' ? 'all time' : `last ${WINDOW_LABEL[window]}`}
      </h2>
      <ul className="desk-moved">
        {moved.map((m) => {
          const b = byName.get(m.name);
          return (
            <li key={m.name}>
              <Link
                href={railHref(m.name)}
                className="desk-moved-card"
                title={`Show the ${m.count} item${m.count === 1 ? '' : 's'} on this rail`}
              >
                <span className="desk-moved-count">
                  {m.count}
                  <span> item{m.count === 1 ? '' : 's'}</span>
                </span>
                <span className="desk-moved-name">{m.name}</span>
                <span className="desk-moved-latest">Latest: {m.latest.title}</span>
                {b && (
                  <span className="desk-moved-score" title={scoreParts(b)}>
                    binding {b.binding}/{BINDING_MAX}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
