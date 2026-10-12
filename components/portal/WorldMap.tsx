'use client';

/**
 * The world view's canvas. The globe (Globe.tsx) and its geometry load after
 * the page, in their own chunk; until then the canvas holds its box, so
 * nothing on the page moves when the globe arrives.
 */
import dynamic from 'next/dynamic';

import type { SitePoint } from './globe-overlay';
import type { RouteHop } from './globe-overlay-state';

export interface WorldMapProps {
  selected?: string;
  /** Query parameters a click on a country keeps (resource, measure). */
  keep: Record<string, string>;
  /** Bin per ISO code: 1–5 up the sequential scale, 6 hatched; absent = not listed. */
  bins: Record<string, number>;
  labels: Record<string, string>;
  /** Figures drawn on the globe at the countries that matter most for this layer. */
  callouts?: { iso: string; text: string }[];
  /** The hover line for a country with no row in this layer. */
  otherwise?: string;
  /** What the globe shows, in words, for a screen reader. */
  summary: string;
  /** Producer sites of the painted resource, as dots a click opens. */
  sites?: SitePoint[];
  /** The site `?site=` opened. */
  site?: string;
  /** A supply chain laid over the Earth: one arc per hop, by country code. */
  routes?: RouteHop[];
}

const Globe = dynamic(() => import('./Globe'), {
  ssr: false,
  loading: () => <div className="wm" data-loading aria-hidden />,
});

export function WorldMap(props: WorldMapProps) {
  return <Globe {...props} />;
}
