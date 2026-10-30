'use client';

/**
 * The globe's renderer: the fleet's one map (`@bitbaum/geo-kit/map`) made on
 * the canvas once the world has loaded, kept current with the layer, the
 * selection, the theme and the part of the canvas nothing floats over, with
 * Substrata's own layer (sites, routes, figures, the pulse) drawn over the
 * Earth each frame and given the first say on a tap or a hover.
 */
import { useEffect, useRef, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { createMap, type MapController, type View } from '@bitbaum/geo-kit/map';

import { HOME, LIMITS, isCountry, type CountryFeature, type World } from './globe-geo';
import { paintMarks } from './globe-marks';
import { EMPTY_OVERLAY, pickSite, type Overlay, type SitePoint } from './globe-overlay';
import { useOverlay, type RouteHop } from './globe-overlay-state';
import { fillsFor, readPalette, type Palette } from './globe-paint';

export interface Hover {
  iso: string;
  name: string;
  /** Set when the pointer is on a producer site rather than a country. */
  site?: string;
  x: number;
  y: number;
}

/** The routes' light runs this long after the last touch, then holds still. */
const ROUTES_RUN_FOR = 90_000;
const NO_SITES: SitePoint[] = [];
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useGlobeRenderer({
  canvasRef,
  world,
  frame,
  bins,
  selected,
  callouts,
  keep,
  sites,
  site,
  routes,
  setHover,
  setFacing,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  world: World | null;
  frame: { width: number; height: number; view: View } | null;
  bins: Record<string, number>;
  selected?: string;
  callouts?: { iso: string; text: string }[];
  keep: Record<string, string>;
  sites?: SitePoint[];
  site?: string;
  routes?: RouteHop[];
  setHover: (hover: Hover | null) => void;
  setFacing: (name: string) => void;
}) {
  const router = useRouter();
  const mapRef = useRef<MapController | null>(null);
  const paletteRef = useRef<Palette | null>(null);
  const overlayRef = useRef<Overlay>(EMPTY_OVERLAY);
  /** When the reader last touched the globe, as the renderer reports it. */
  const touchedAtRef = useRef(0);
  const calloutsRef = useRef<{ feature: CountryFeature; text: string }[]>([]);
  const selectedRef = useRef(selected);
  const binsRef = useRef(bins);
  const byIso = useRef(new Map<string, CountryFeature>());
  const invalidate = () => mapRef.current?.invalidate();
  const hoverSite = useOverlay({ overlayRef, world, sites, site, routes, invalidate });
  const latest = useRef({ keep, sites: sites ?? NO_SITES, hoverSite, router });
  useEffect(() => {
    latest.current = { keep, sites: sites ?? NO_SITES, hoverSite, router };
    selectedRef.current = selected;
  });

  // The renderer, made once the world has loaded.
  useEffect(() => {
    const el = canvasRef.current;
    const ctx = el?.getContext('2d');
    if (!world || !el || !ctx) return;
    byIso.current = new Map(world.countries.map((c) => [c.id, c]));
    const go = (extra: Record<string, string>) => {
      const params = new URLSearchParams({ view: 'world', ...latest.current.keep, ...extra });
      latest.current.router.push(`/atlas?${params.toString()}`, { scroll: false });
    };
    const palette = readPalette(el);
    paletteRef.current = palette;
    const map = createMap(el, {
      shapes: world,
      palette,
      fills: fillsFor(ctx, palette, bins),
      limits: LIMITS,
      home: HOME,
      idleTurn: true,
      onSelect: (id) => {
        if (isCountry(id)) go({ country: id });
      },
      onHover: (id, x, y) => {
        latest.current.hoverSite('');
        const f = isCountry(id) ? byIso.current.get(id) : undefined;
        setHover(f ? { iso: f.id, name: f.properties.name, x, y } : null);
      },
      pickFirst: (x, y, projection, kind) => {
        const s = pickSite(latest.current.sites, projection, x, y);
        if (kind === 'tap') {
          if (s) go({ site: s.id });
          return !!s;
        }
        latest.current.hoverSite(s?.id ?? '');
        if (s) setHover({ iso: '', name: s.label, site: s.id, x, y });
        return !!s;
      },
      onFacing: (id) => {
        setHover(null);
        setFacing((isCountry(id) && byIso.current.get(id)?.properties.name) || 'open ocean');
      },
      // A route holds the globe where it was put: turning it would carry the
      // chain off the face the reader is reading.
      holdStill: () => overlayRef.current.arcs.length > 0,
      animating: (now) =>
        overlayRef.current.arcs.length > 0 &&
        !reducedMotion() &&
        now - touchedAtRef.current < ROUTES_RUN_FOR,
      over: (c, basis, _projection, f) => {
        touchedAtRef.current = f.now - f.sinceTouch;
        const overlay = overlayRef.current;
        const flowing =
          overlay.arcs.length > 0 && !reducedMotion() && f.sinceTouch < ROUTES_RUN_FOR;
        const picked = selectedRef.current ? byIso.current.get(selectedRef.current) : undefined;
        paintMarks(c, basis, paletteRef.current ?? palette, {
          callouts: calloutsRef.current,
          // The pulse rides the flight to a picked country: one ring that
          // opens from where the country is and fades as the globe arrives.
          pulse: f.flight !== null && picked ? { feature: picked, t: f.flight } : undefined,
          overlay,
          now: flowing ? f.now : null,
        });
      },
    });
    mapRef.current = map;
    // Colours from the tokens; read again when the theme flips them.
    const recolour = () => {
      const next = readPalette(el);
      paletteRef.current = next;
      map.setPalette(next);
      map.setFills(fillsFor(ctx, next, binsRef.current));
    };
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', recolour);
    const attrs = new MutationObserver(recolour);
    attrs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });
    return () => {
      media.removeEventListener('change', recolour);
      attrs.disconnect();
      map.destroy();
      mapRef.current = null;
    };
    // The renderer is made once per world; the layer, selection and size update it in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);

  useEffect(() => {
    binsRef.current = bins;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && paletteRef.current)
      mapRef.current?.setFills(fillsFor(ctx, paletteRef.current, bins));
  }, [bins, canvasRef]);

  useEffect(() => {
    calloutsRef.current = (callouts ?? []).flatMap((c) => {
      const feature = byIso.current.get(c.iso);
      return feature ? [{ feature, text: c.text }] : [];
    });
    mapRef.current?.invalidate();
  }, [callouts, world]);

  useEffect(() => {
    mapRef.current?.setSelected(selected ?? null);
  }, [selected, world]);

  // Size the canvas to its box and frame the globe in the part nothing floats over.
  useEffect(() => {
    if (frame) mapRef.current?.resize(frame.width, frame.height, frame.view);
  }, [frame, world]);

  return { mapRef, byIso };
}
