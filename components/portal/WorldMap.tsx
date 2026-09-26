'use client';

/**
 * The world view's canvas. The globe (Globe.tsx) and its geometry load after
 * the page, in their own chunk; until then the canvas holds its box, so
 * nothing on the page moves when the globe arrives.
 */
import dynamic from 'next/dynamic';

export interface WorldMapProps {
  selected?: string;
  /** Query parameters a click on a country keeps (resource, measure). */
  keep: Record<string, string>;
  /** Bin per ISO code: 1–5 up the sequential scale, 6 hatched; absent = not listed. */
  bins: Record<string, number>;
  labels: Record<string, string>;
  /** The hover line for a country with no row in this layer. */
  otherwise?: string;
  /** What the globe shows, in words, for a screen reader. */
  summary: string;
}

const Globe = dynamic(() => import('./Globe'), {
  ssr: false,
  loading: () => <div className="wm" data-loading aria-hidden />,
});

export function WorldMap(props: WorldMapProps) {
  return <Globe {...props} />;
}
