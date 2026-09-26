'use client';

/**
 * The globe's frame loop: where it looks (the camera), what is moving it (a
 * flight, a coast, the idle turn), where the disc sits as the sheet or panel
 * moves, and one paint per frame — only while something changes. Everything
 * the loop reads lives in refs, so a drag never re-renders React.
 */
import { useCallback, useEffect, useRef, type RefObject } from 'react';

import {
  HOME,
  disc,
  projectionFor,
  wrapLon,
  type Camera,
  type CountryFeature,
  type View,
  type World,
} from './globe-geo';
import { coast, flight, type Flight, type Spin } from './globe-motion';
import { paintFor, paintGlobe, type Paint } from './globe-paint';

const IDLE_BEFORE_TURNING = 4000;
const STOP_TURNING_AFTER = 120_000;
const TURN_PER_MS = 0.004; // degrees: a full turn in about 90 seconds
/** How long the globe takes to follow the sheet or panel to a new place. */
const FOLLOW_MS = 280;

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const pixelRatio = () => Math.min(window.devicePixelRatio || 1, 2);

export function useGlobeLoop({
  canvasRef,
  world,
  frame,
  bins,
  selected,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  world: World | null;
  frame: { width: number; height: number; view: View } | null;
  bins: Record<string, number>;
  selected?: string;
}) {
  const cameraRef = useRef<Camera>(HOME);
  const shown = useRef<{ from: View; to: View; start: number } | null>(null);
  const motionRef = useRef<{ flight?: { f: Flight; start: number }; spin?: Spin }>({});
  /** When the reader last touchedRef the globe; the idle turn waits for it. */
  const touchedRef = useRef(0);
  const hoverRef = useRef('');
  /** A finger or button is down: paint coarse until it lifts. */
  const grabbed = useRef(false);
  const selectedRef = useRef(selected);
  const paint = useRef<Paint | null>(null);
  const byIso = useRef(new Map<string, CountryFeature>());
  const raf = useRef(0);
  const wake = useRef(0);
  /** The frame callback, so a frame can ask for the next one. */
  const next = useRef<FrameRequestCallback>(() => {});
  const last = useRef(0);

  /** The visible part the globe sits in, eased when the sheet or panel moves. */
  const viewAt = useCallback((now: number): View | null => {
    const s = shown.current;
    if (!s) return null;
    const t = Math.min((now - s.start) / FOLLOW_MS, 1);
    if (t >= 1) return s.to;
    const e = 1 - (1 - t) ** 3;
    const at = (k: keyof View) => lerp(s.from[k], s.to[k], e);
    return { x0: at('x0'), y0: at('y0'), x1: at('x1'), y1: at('y1') };
  }, []);

  const projection = useCallback(
    (now = performance.now()) => {
      const view = viewAt(now);
      return view ? projectionFor(view, cameraRef.current) : null;
    },
    [viewAt],
  );

  const radius = useCallback(() => {
    const view = viewAt(performance.now());
    return view ? disc(view).radius : 200;
  }, [viewAt]);

  /** Advance whatever is moving; true while another frame is needed. */
  const advance = useCallback(
    (now: number, dt: number): boolean => {
      const m = motionRef.current;
      if (m.flight) {
        const t = (now - m.flight.start) / m.flight.f.duration;
        cameraRef.current = m.flight.f.at(t);
        if (t < 1) return true;
        m.flight = undefined;
        return false;
      }
      if (m.spin) {
        const step = coast(cameraRef.current, m.spin, dt, radius());
        cameraRef.current = step.camera;
        m.spin = step.spin;
        return !!step.spin;
      }
      if (selectedRef.current || cameraRef.current.k > 1.3 || reducedMotion()) return false;
      const idle = now - touchedRef.current;
      if (idle > IDLE_BEFORE_TURNING && idle < STOP_TURNING_AFTER) {
        const [lon, lat] = cameraRef.current.center;
        cameraRef.current = {
          ...cameraRef.current,
          center: [wrapLon(lon + TURN_PER_MS * dt), lat],
        };
        return true;
      }
      if (idle <= IDLE_BEFORE_TURNING) {
        // Nothing to draw until the turn may start: wake then, not every frame.
        window.clearTimeout(wake.current);
        wake.current = window.setTimeout(
          () => {
            raf.current ||= requestAnimationFrame(next.current);
          },
          IDLE_BEFORE_TURNING - idle + 20,
        );
      }
      return false;
    },
    [radius],
  );

  const tick = useCallback(
    (now: number) => {
      raf.current = 0;
      const dt = Math.min(now - (last.current || now), 64);
      last.current = now;
      const moving = advance(now, dt) || grabbed.current;
      let again = moving;
      if (shown.current && now - shown.current.start < FOLLOW_MS) again = true;
      const el = canvasRef.current;
      const ctx = el?.getContext('2d');
      const proj = projection(now);
      if (el && ctx && proj && world && paint.current) {
        const dpr = pixelRatio();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const shapes = moving ? world.coarse : world;
        paintGlobe(ctx, { w: el.width / dpr, h: el.height / dpr }, proj, shapes, paint.current, {
          hover: byIso.current.get(hoverRef.current),
          selected: selectedRef.current ? byIso.current.get(selectedRef.current) : undefined,
        });
      }
      if (again) raf.current = requestAnimationFrame(next.current);
      else last.current = 0;
    },
    [advance, canvasRef, projection, world],
  );

  const invalidate = useCallback(() => {
    if (!raf.current) raf.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => {
    next.current = tick;
    selectedRef.current = selected;
  }, [tick, selected]);

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      window.clearTimeout(wake.current);
    },
    [],
  );

  useEffect(() => {
    if (world) byIso.current = new Map(world.countries.map((c) => [c.properties.iso, c]));
  }, [world]);

  // Colours from the tokens; read again when the theme flips them.
  useEffect(() => {
    const regroup = () => {
      const el = canvasRef.current;
      const ctx = el?.getContext('2d');
      if (!world || !el || !ctx) return;
      paint.current = paintFor(ctx, el, world.countries, bins);
      invalidate();
    };
    regroup();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', regroup);
    const attrs = new MutationObserver(regroup);
    attrs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });
    return () => {
      media.removeEventListener('change', regroup);
      attrs.disconnect();
    };
  }, [canvasRef, world, bins, invalidate]);

  // Size the canvas to its box at the device's pixel ratio; follow the view.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || !frame) return;
    const dpr = pixelRatio();
    const w = Math.round(frame.width * dpr);
    const h = Math.round(frame.height * dpr);
    if (el.width !== w || el.height !== h) {
      el.width = w;
      el.height = h;
    }
    const now = performance.now();
    const from = viewAt(now);
    shown.current =
      from && !reducedMotion()
        ? { from, to: frame.view, start: now }
        : { from: frame.view, to: frame.view, start: 0 };
    invalidate();
  }, [canvasRef, frame, viewAt, invalidate]);

  /** Go to a view: a flight, or a cut under reduced motionRef. */
  const fly = useCallback(
    (to: Camera, duration?: number) => {
      motionRef.current = {};
      touchedRef.current = performance.now();
      if (reducedMotion()) cameraRef.current = to;
      else {
        const f = flight(cameraRef.current, to);
        motionRef.current.flight = {
          f: duration ? { ...f, duration } : f,
          start: performance.now(),
        };
      }
      invalidate();
    },
    [invalidate],
  );

  return {
    cameraRef,
    motionRef,
    touchedRef,
    hoverRef,
    grabbedRef: grabbed,
    projection,
    radius,
    invalidate,
    fly,
  };
}
