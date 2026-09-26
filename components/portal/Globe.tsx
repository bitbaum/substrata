'use client';

/**
 * The world as a globe: Natural Earth 1:50m on an orthographic projection,
 * painted on one <canvas> by the layer the server chose (app/atlas/
 * map-layer.ts). Drag turns it (with inertia), wheel and pinch zoom, a click
 * turns the country to face the reader and opens its panel. With nothing
 * picked and nobody touching it, it turns slowly — never under
 * prefers-reduced-motion.
 *
 * Canvas 2D, not WebGL: 240 filled outlines are a few thousand path segments
 * a frame, which a phone's 2D canvas draws inside a frame budget, and it runs
 * everywhere a browser runs this page — so there is no second, flat map to
 * fall back to. Drawn only when something changes; idle, it costs nothing.
 *
 * Split by job: geometry (globe-geo), movement (globe-motion), picking
 * (globe-pick), painting (globe-paint), the frame loop (globe-loop), input
 * (globe-input). This file wires them to the page: selection, the control
 * the input drives, the text alternative, the zoom buttons and hover card.
 * Every country is also reachable by name in the panel's search, which is
 * how Malta or Singapore are reached on a phone.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  cameraFor,
  clampTilt,
  clampZoom,
  loadWorld,
  wrapLon,
  type CountryFeature,
  type World,
} from './globe-geo';
import { useGlobeInput, type GlobeControl } from './globe-input';
import { reducedMotion, useGlobeLoop } from './globe-loop';
import { dragged } from './globe-motion';
import { pickAt, pickIndex, type Pickable } from './globe-pick';
import { useMapView } from './map-view';
import type { WorldMapProps } from './WorldMap';

export default function Globe({ selected, keep, bins, labels, otherwise, summary }: WorldMapProps) {
  const router = useRouter();
  const wrap = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [world, setWorld] = useState<World | null>(null);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<{ iso: string; name: string; x: number; y: number } | null>(
    null,
  );
  const [facing, setFacing] = useState('');

  useEffect(() => {
    loadWorld().then(setWorld, () => setFailed(true));
  }, []);

  const frame = useMapView(wrap);
  const loop = useGlobeLoop({ canvasRef, world, frame, bins, selected });
  const { cameraRef, motionRef, touchedRef, hoverRef, grabbedRef } = loop;
  const { projection, radius, invalidate, fly } = loop;

  const index = useRef<Pickable[]>([]);
  const byIso = useRef(new Map<string, CountryFeature>());
  useEffect(() => {
    if (!world) return;
    index.current = pickIndex(world.countries.filter((c) => c.properties.iso));
    byIso.current = new Map(world.countries.map((c) => [c.properties.iso, c]));
  }, [world]);

  // Face the selected country: at once on first draw, by a flight after.
  const faced = useRef<string | null>(null);
  useEffect(() => {
    if (!world || faced.current === (selected ?? '')) return;
    const first = faced.current === null;
    faced.current = selected ?? '';
    const target = selected ? byIso.current.get(selected) : undefined;
    const c = cameraRef.current;
    const to = target ? cameraFor(target) : { center: c.center, k: Math.min(c.k, 1) };
    if (!first) return fly(to);
    cameraRef.current = to;
    touchedRef.current = performance.now();
    invalidate();
  }, [world, selected, cameraRef, touchedRef, fly, invalidate]);

  // What the input may do to the globe; kept current for its handlers.
  const controlRef = useRef<GlobeControl | null>(null);
  useEffect(() => {
    const pick = (x: number, y: number) => {
      const proj = projection();
      return proj ? pickAt(index.current, proj, x, y) : null;
    };
    const facingNow = () => {
      const proj = projection();
      return proj ? pick(...proj.translate()) : null;
    };
    const open = (f: CountryFeature | null) => {
      if (!f?.properties.iso) return;
      const params = new URLSearchParams({ view: 'world', ...keep, country: f.properties.iso });
      router.push(`/atlas?${params.toString()}`, { scroll: false });
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
      tap: (x, y) => open(pick(x, y)),
      hoverAt(x, y) {
        const f = pick(x, y);
        touchedRef.current = performance.now();
        markHover(f);
        setHover(f ? { iso: f.properties.iso, name: f.properties.name, x, y } : null);
      },
      hoverOff() {
        markHover(null);
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
    invalidate,
    keep,
    motionRef,
    projection,
    radius,
    router,
    touchedRef,
  ]);

  useGlobeInput(canvasRef, controlRef);
  const chosen = selected ? world?.countries.find((c) => c.properties.iso === selected) : undefined;

  return (
    <div ref={wrap} className="wm" data-loading={!world || undefined}>
      <canvas
        ref={canvasRef}
        className="wm-globe"
        style={{ width: frame?.width ?? 0, height: frame?.height ?? 0 }}
        role="application"
        aria-roledescription="globe"
        aria-label={`Globe${chosen ? `, facing ${chosen.properties.name}` : ''}. Arrow keys turn it, plus and minus zoom, Home shows the whole globe, Enter opens the country facing you. Every country is also in the list in the panel.`}
        aria-describedby="wm-summary"
        tabIndex={0}
      />
      <p id="wm-summary" className="sr-only">
        {summary}
      </p>
      <p className="sr-only" aria-live="polite">
        {facing && `Facing ${facing}`}
      </p>
      {hover && (
        <div className="wm-tip" style={{ left: hover.x, top: hover.y }} aria-hidden>
          <strong>{hover.name}</strong>
          {(labels[hover.iso] ?? otherwise) && <span>{labels[hover.iso] ?? otherwise}</span>}
        </div>
      )}
      {failed && (
        <p className="wm-failed">The globe could not load. The country list still works.</p>
      )}
      <div className="wm-zoom" role="group" aria-label="Zoom">
        <button type="button" onClick={() => controlRef.current?.zoomBy(1.5)} aria-label="Zoom in">
          +
        </button>
        <button
          type="button"
          onClick={() => controlRef.current?.zoomBy(1 / 1.5)}
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => controlRef.current?.zoomBy('home')}
          aria-label="Show the whole globe"
        >
          ⟲
        </button>
      </div>
    </div>
  );
}
