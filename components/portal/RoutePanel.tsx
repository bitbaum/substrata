/**
 * The panel beside a chain laid over the globe (/atlas?view=world&chain=):
 * the steps in the order material moves, numbered as the globe labels them,
 * each with where it is made — and what the lines do and do not mean.
 */
import Link from 'next/link';

import { placesLine, type ChainRoute } from '@/app/atlas/chain-route';
import { chainHref } from '@/app/atlas/chain-data';
import type { Bottleneck } from '@/lib/bottlenecks';

export function RouteHead({ chain, closeHref }: { chain: Bottleneck; closeHref: string }) {
  return (
    <div className="atlas-head-row">
      <div>
        <p className="atlas-kicker">The chain, on the globe</p>
        <p className="atlas-title">{chain.name}</p>
      </div>
      <Link className="atlas-close" href={closeHref} aria-label="Take the chain off the globe">
        ×
      </Link>
    </div>
  );
}

const SIDE: Record<string, string> = {
  up: 'Goes into it',
  self: 'This bottleneck',
  down: 'Holds up',
};

export function RoutePanel({ chain, route }: { chain: Bottleneck; route: ChainRoute }) {
  return (
    <>
      <ol className="route-steps">
        {route.steps.map((s) => {
          const side = s.level < 0 ? 'up' : s.level === 0 ? 'self' : 'down';
          return (
            <li key={s.slug} data-side={side}>
              <span className="route-num" aria-hidden>
                {s.step}
              </span>
              <div>
                <p className="route-side">{SIDE[side]}</p>
                {s.level === 0 ? (
                  <p className="route-name">{s.name}</p>
                ) : (
                  <Link className="route-name" href={chainHref(s.slug)}>
                    {s.name}
                  </Link>
                )}
                <p className="route-where">{placesLine(s.isos)}</p>
                {s.beyond > 0 && (
                  <p className="route-where">
                    The chain goes on: {s.beyond} more step{s.beyond === 1 ? '' : 's'} past this
                    one.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {route.parts.length > 0 && (
        <section className="atlas-section">
          <h3>Critical parts</h3>
          <p className="atlas-fine">
            {route.parts.map((p) => `${p.name} (${placesLine(p.isos)})`).join('; ')} supply parts
            the maker cannot ship without, drawn as lines into it.
          </p>
        </section>
      )}
      <section className="atlas-section">
        <h3>Reading the lines</h3>
        <p className="atlas-fine">
          Each line joins where a step is made to where the step that needs it is made, and the
          light runs the way material moves. They show dependence on record, not recorded shipments:
          a country on a line makes the input, which is not the same as selling it along that line.
        </p>
      </section>
      <div className="atlas-actions">
        <Link href={chainHref(chain.slug)} className="atlas-secondary">
          ← Back to the diagram
        </Link>
      </div>
    </>
  );
}
