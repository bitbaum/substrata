/**
 * The atlas' one floating control bar: which view, and the one choice that
 * view needs — a bottleneck for chains, a resource to paint the world by.
 * A plain GET form underneath, so it works before (and without) JavaScript.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

import { AutoSubmitForm } from './AutoSubmitForm';

export function AtlasBar({
  view,
  worldHref,
  children,
}: {
  view: 'chain' | 'world';
  /** The world view keeps a painted resource when the reader flips back. */
  worldHref: string;
  children: ReactNode;
}) {
  return (
    <div className="atlas-bar">
      <nav className="atlas-switch" aria-label="Map view">
        <Link href="/atlas" aria-current={view === 'chain' ? 'page' : undefined}>
          Chains
        </Link>
        <Link href={worldHref} aria-current={view === 'world' ? 'page' : undefined}>
          World
        </Link>
      </nav>
      {children}
    </div>
  );
}

/** One labelled select that applies itself; hidden fields carry the rest of the URL. */
export function AtlasPick({
  label,
  name,
  value,
  hidden,
  children,
}: {
  label: string;
  name: string;
  value: string;
  hidden: Record<string, string | undefined>;
  children: ReactNode;
}) {
  return (
    <AutoSubmitForm action="/atlas" className="atlas-pick">
      {Object.entries(hidden).map(([key, v]) =>
        v ? <input key={key} type="hidden" name={key} value={v} /> : null,
      )}
      <label className="sr-only" htmlFor={`atlas-${name}`}>
        {label}
      </label>
      <select key={value} id={`atlas-${name}`} name={name} defaultValue={value}>
        {children}
      </select>
      <noscript>
        <button type="submit">Show</button>
      </noscript>
    </AutoSubmitForm>
  );
}
