/**
 * The reading beside a chain. From 1024px it floats at the right of the
 * diagram, as the atlas panel does. Below that it is not a sheet but the page
 * itself: a pull-up sheet on a phone kept the chain's name, the diagram and
 * the reading in three places at once, scrolled inside a page that also
 * scrolled, with a grip and a tab grid eating a quarter of the screen (owner,
 * 2026-10-12, from a phone). Here a phone reads top to bottom — what it is,
 * the route in one strip, the tabs pinned under the top bar, the reading at
 * full width — and nothing floats over it.
 *
 * A server component: no snap state, no script.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

import { chainHref, type ChainFlow } from '@/app/atlas/chain-data';
import type { ChainRoute } from '@/app/atlas/chain-route';

/** "NL", "CN PE +5": where a step is made, at a glance. */
function codes(isos: string[], max = 2): string {
  if (isos.length === 0) return '';
  const shown = isos.slice(0, max).map((c) => c.toUpperCase());
  return isos.length > max ? `${shown.join(' ')} +${isos.length - max}` : shown.join(' ');
}

/** The route as one strip, for a phone, where the diagram does not fit. */
export function RouteStrip({
  route,
  topic,
  lens,
}: {
  route: ChainRoute;
  topic?: string;
  lens?: string;
}) {
  if (route.steps.length < 2) return null;
  return (
    <nav className="route-strip" aria-label="The chain, step by step">
      <ol>
        {route.steps.map((s, i) => {
          const joiner =
            i === 0 ? null : s.level !== route.steps[i - 1].level ? 'goes into' : 'and';
          return (
            <li key={s.slug} data-joiner={joiner ?? undefined}>
              <Link
                href={chainHref(s.slug, topic || undefined, undefined, lens)}
                scroll={false}
                aria-current={s.level === 0 ? 'page' : undefined}
              >
                <span className="route-strip-meta">
                  {String(s.step).padStart(2, '0')}
                  {s.isos.length > 0 && ` · ${codes(s.isos)}`}
                </span>
                <span className="route-strip-name">{s.name}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Who makes it, in one line, for a phone, where the diagram's card is not shown. */
export function MakersLine({ flow }: { flow: ChainFlow }) {
  const makers = flow.makers.filter((m) => !m.supplier);
  const parts = flow.makers.filter((m) => m.supplier);
  if (makers.length === 0 && parts.length === 0) return null;
  const list = (nodes: typeof makers) =>
    nodes.map((m, i) => (
      <span key={m.href}>
        {i > 0 && ', '}
        <Link href={m.href} scroll={false}>
          {m.label}
        </Link>
      </span>
    ));
  return (
    <p className="chain-read-makers">
      {makers.length > 0 && (
        <>
          <span className="chain-read-makers-label">Made by</span> {list(makers)}
        </>
      )}
      {parts.length > 0 && (
        <>
          {makers.length > 0 && <span aria-hidden> · </span>}
          <span className="chain-read-makers-label">Parts from</span> {list(parts)}
        </>
      )}
    </p>
  );
}

export function ChainReader({
  label,
  head,
  children,
}: {
  label: string;
  head: ReactNode;
  children: ReactNode;
}) {
  return (
    <aside className="chain-read" aria-label={label}>
      <div className="chain-read-head">{head}</div>
      {children}
    </aside>
  );
}
