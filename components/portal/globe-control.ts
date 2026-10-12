'use client';

/**
 * What the reader's hands may do to the globe, kept current for the input
 * handlers (globe-input.ts): turn, zoom, coast, and pick — a producer site
 * first when one is within reach, else the country under the finger.
 */
import { useEffect, useRef, type RefObject } from 'react';
import { useRouter } from 'next/navigation';

import { clampTilt, clampZoom, wrapLon, type Camera, type CountryFeature } from './globe-geo';
import type { GlobeControl } from './globe-input';
import { reducedMotion } from './globe-loop';
import { dragged } from './globe-motion';
import { pickSite, type SitePoint } from './globe-overlay';
import { pickAt, type Pickable } from './globe-pick';
import type { GeoProjection } from 'd3-geo';

export interface Hover {
  iso: string;
  name: string;
  /** Set when the pointer is on a producer site rather than a country. */
  site?: string;
  x: number;
  y: number;
}

interface Loop {
  cameraRef: RefObject<Camera>;
  motionRef: RefObject<{ flight?: unknown; spin?: unknown }>;
  touchedRef: RefObject<number>;
  hoverRef: RefObject<string>;
  grabbedRef: RefObject<boolean>;
  projection: () => GeoProjection | null;
  radius: () => number;
  invalidate: () => void;
  fly: (to: Camera, duration?: number) => void;
}

export function useGlobeControl({
  loop,
  index,
  keep,
  sites,
  hoverSite,
  setHover,
  setFacing,
}: {
  loop: Loop;
  index: RefObject<Pickable[]>;
  keep: Record<string, string>;
  sites: SitePoint[];
  hoverSite: (id: string) => void;
  setHover: (h: Hover | null) => void;
  setFacing: (name: string) => void;
}) {
  const router = useRouter();
  const controlRef = useRef<GlobeControl | null>(null);
  const { cameraRef, motionRef, touchedRef, hoverRef, grabbedRef } = loop;
  const { projection, radius, invalidate, fly } = loop;

  useEffect(() => {
    const pick = (x: number, y: number) => {
      const proj = projection();
      return proj ? pickAt(index.current, proj, x, y) : null;
    };
    const site = (x: number, y: number) => {
      const proj = projection();
      return proj ? pickSite(sites, proj, x, y) : null;
    };
    const facingNow = () => {
      const proj = projection();
      return proj ? pick(...proj.translate()) : null;
    };
    const go = (extra: Record<string, string>) => {
      const params = new URLSearchParams({ view: 'world', ...keep, ...extra });
      router.push(`/atlas?${params.toString()}`, { scroll: false });
    };
    const open = (f: CountryFeature | null) => {
      if (f?.properties.iso) go({ country: f.properties.iso });
    };
    const markHover = (f: CountryFeature | null) => {
      const iso = f?.properties.iso ?? '';
      if (iso === hoverRef.current) return;
      hoverRef.current = iso;
      invalidate();
    };
    const moved = () => {
      touchedRef.current = performance.now();
      setHover(null);
      invalidate();
    };
    controlRef.current = {
      grab() {
        motionRef.current = {};
        touchedRef.current = performance.now();
      },
      hold(down) {
        grabbedRef.current = down;
        if (!down) invalidate(); // the frame after the gesture is full detail
      },
      drag(dx, dy) {
        cameraRef.current = dragged(cameraRef.current, dx, dy, radius());
        moved();
      },
      scale(factor) {
        cameraRef.current = { ...cameraRef.current, k: clampZoom(cameraRef.current.k * factor) };
        moved();
      },
      coast(spin) {
        motionRef.current.spin = spin;
        invalidate();
      },
      tap(x, y) {
        const s = site(x, y);
        if (s) go({ site: s.id });
        else open(pick(x, y));
      },
      hoverAt(x, y) {
        touchedRef.current = performance.now();
        const s = site(x, y);
        hoverSite(s?.id ?? '');
        const f = pick(x, y);
        markHover(s ? null : f);
        if (s) setHover({ iso: '', name: s.label, site: s.id, x, y });
        else setHover(f ? { iso: f.properties.iso, name: f.properties.name, x, y } : null);
      },
      hoverOff() {
        markHover(null);
        hoverSite('');
        setHover(null);
      },
      zoomBy(factor) {
        const c = cameraRef.current;
        const k = factor === 'home' ? 1 : clampZoom(c.k * factor);
        fly({ center: c.center, k }, 260);
      },
      turn(dLon, dLat) {
        const c = cameraRef.current;
        motionRef.current = {};
        cameraRef.current = {
          center: [wrapLon(c.center[0] + dLon / c.k), clampTilt(c.center[1] + dLat / c.k)],
          k: c.k,
        };
        moved();
        setFacing(facingNow()?.properties.name ?? 'open ocean');
      },
      openFacing: () => open(facingNow()),
      reducedMotion,
    };
  }, [
    cameraRef,
    fly,
    grabbedRef,
    hoverRef,
    hoverSite,
    index,
    invalidate,
    keep,
    motionRef,
    projection,
    radius,
    router,
    setFacing,
    setHover,
    sites,
    touchedRef,
  ]);

  return controlRef;
}
