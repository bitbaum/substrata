'use client';

/**
 * The overlay as the frame loop reads it: sites as given, routes resolved
 * from country codes to sampled arcs once per change (not per frame), and the
 * site under the pointer. Held in a ref so painting never re-renders React.
 */
import { useCallback, useEffect, useRef, type RefObject } from 'react';

import { focusOf, type World } from './globe-geo';
import { arcOf, type Overlay, type SitePoint } from './globe-overlay';

export interface RouteHop {
  from: string;
  to: string;
}

export function useOverlay({
  overlayRef,
  world,
  sites = [],
  site,
  routes = [],
  invalidate,
}: {
  /** Owned by the globe and read by the frame loop. */
  overlayRef: RefObject<Overlay>;
  world: World | null;
  sites?: SitePoint[];
  site?: string;
  routes?: RouteHop[];
  invalidate: () => void;
}) {
  const hoverSiteRef = useRef('');

  useEffect(() => {
    if (!world) return;
    const anchor = new Map(world.countries.map((c) => [c.properties.iso, c]));
    const at = (iso: string) => {
      const f = anchor.get(iso);
      return f ? focusOf(f).center : null;
    };
    const arcs = routes.flatMap((hop) => {
      const from = at(hop.from);
      const to = at(hop.to);
      return from && to && hop.from !== hop.to
        ? [arcOf(`${hop.from}>${hop.to}`, from as [number, number], to as [number, number])]
        : [];
    });
    overlayRef.current = { sites, site, arcs, hoverSite: hoverSiteRef.current };
    invalidate();
  }, [overlayRef, world, sites, site, routes, invalidate]);

  return useCallback(
    (id: string) => {
      if (id === hoverSiteRef.current) return;
      hoverSiteRef.current = id;
      overlayRef.current = { ...overlayRef.current, hoverSite: id };
      invalidate();
    },
    [overlayRef, invalidate],
  );
}
