'use client';

/**
 * The globe's input: one finger (or the mouse) turns it, two pinch, the wheel
 * zooms, a tap without movement opens the country under it, a flick keeps it
 * turning. The keyboard treats the canvas as one control: arrows turn it
 * (Shift for larger steps), + and − zoom, Home resets, Enter opens the
 * country facing the reader.
 *
 * What the input does to the globe goes through `GlobeControl`, which the
 * globe keeps current in a ref, so a drag never re-renders React.
 */
import { useEffect, useRef, type RefObject } from 'react';

import type { Spin } from './globe-motion';

export interface GlobeControl {
  /** A gestureRef began: stop any flight or coast, and hold the idle turn. */
  grab(): void;
  /** Turn by a drag of (dx, dy) CSS pixels. */
  drag(dx: number, dy: number): void;
  /** Multiply the zoom (pinch, wheel). */
  scale(factor: number): void;
  coast(spin: Spin): void;
  /** Open the country at a canvasRef point, if there is one. */
  tap(x: number, y: number): void;
  hoverAt(x: number, y: number): void;
  hoverOff(): void;
  zoomBy(factor: number | 'home'): void;
  turn(dLon: number, dLat: number): void;
  openFacing(): void;
  reducedMotion(): boolean;
}

/** Past this a press is a drag, not a tap. */
const TAP_SLOP = 6;

export function useGlobeInput(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  controlRef: RefObject<GlobeControl | null>,
) {
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef({ moved: false, vx: 0, vy: 0, t: 0, startX: 0, startY: 0 });

  // Native listeners, attached once: they read the refs when an event
  // fires, and the pointer ones must see every move, not React's batch.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const local = (e: { clientX: number; clientY: number }) => {
      const box = canvasRef.current?.getBoundingClientRect();
      return { x: e.clientX - (box?.left ?? 0), y: e.clientY - (box?.top ?? 0) };
    };
    const on = {
      keydown(e: KeyboardEvent) {
        const c = controlRef.current;
        if (!c) return;
        const step = e.shiftKey ? 30 : 10;
        const keys: Record<string, () => void> = {
          ArrowLeft: () => c.turn(-step, 0),
          ArrowRight: () => c.turn(step, 0),
          ArrowUp: () => c.turn(0, step),
          ArrowDown: () => c.turn(0, -step),
          '+': () => c.zoomBy(1.5),
          '=': () => c.zoomBy(1.5),
          '-': () => c.zoomBy(1 / 1.5),
          '0': () => c.zoomBy('home'),
          Home: () => c.zoomBy('home'),
          Enter: () => c.openFacing(),
        };
        const run = keys[e.key];
        if (!run) return;
        e.preventDefault();
        run();
      },
      pointerdown(e: PointerEvent) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        canvasRef.current?.setPointerCapture(e.pointerId);
        const at = local(e);
        pointersRef.current.set(e.pointerId, at);
        if (pointersRef.current.size === 1)
          gestureRef.current = {
            moved: false,
            vx: 0,
            vy: 0,
            t: e.timeStamp,
            startX: at.x,
            startY: at.y,
          };
        else gestureRef.current.moved = true; // a second finger is never a tap
        controlRef.current?.grab();
      },
      pointermove(e: PointerEvent) {
        const c = controlRef.current;
        const at = local(e);
        const before = pointersRef.current.get(e.pointerId);
        if (!c) return;
        if (!before) {
          if (e.pointerType === 'mouse') c.hoverAt(at.x, at.y);
          return;
        }
        const g = gestureRef.current;
        if (pointersRef.current.size === 1) {
          if (Math.hypot(at.x - g.startX, at.y - g.startY) > TAP_SLOP) g.moved = true;
          if (g.moved) {
            const dx = at.x - before.x;
            const dy = at.y - before.y;
            c.drag(dx, dy);
            const dt = Math.max(e.timeStamp - g.t, 1);
            // Smoothed velocity in px/ms, for the coast after release.
            g.vx = g.vx * 0.6 + (dx / dt) * 0.4;
            g.vy = g.vy * 0.6 + (dy / dt) * 0.4;
            g.t = e.timeStamp;
          }
        } else if (pointersRef.current.size === 2) {
          const other = [...pointersRef.current.entries()].find(([id]) => id !== e.pointerId)?.[1];
          if (other) {
            const d0 = Math.hypot(before.x - other.x, before.y - other.y);
            const d1 = Math.hypot(at.x - other.x, at.y - other.y);
            if (d0 > 0) c.scale(d1 / d0);
          }
        }
        pointersRef.current.set(e.pointerId, at);
      },
      pointerup(e: PointerEvent) {
        const c = controlRef.current;
        if (!pointersRef.current.delete(e.pointerId) || pointersRef.current.size > 0 || !c) return;
        const g = gestureRef.current;
        if (!g.moved) {
          const at = local(e);
          c.tap(at.x, at.y);
          return;
        }
        const fresh = e.timeStamp - g.t < 80;
        if (fresh && !c.reducedMotion() && Math.hypot(g.vx, g.vy) > 0.05)
          c.coast({ vx: g.vx, vy: g.vy });
      },
      pointercancel(e: PointerEvent) {
        pointersRef.current.delete(e.pointerId);
      },
      pointerleave(e: PointerEvent) {
        if (e.pointerType === 'mouse') controlRef.current?.hoverOff();
      },
    };
    // React's wheel listener is passive; this one must be able to cancel.
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      controlRef.current?.grab();
      controlRef.current?.scale(Math.exp(-px * 0.0018));
    };
    const listeners: [string, EventListener][] = [
      ['keydown', on.keydown as EventListener],
      ['pointerdown', on.pointerdown as EventListener],
      ['pointermove', on.pointermove as EventListener],
      ['pointerup', on.pointerup as EventListener],
      ['pointercancel', on.pointercancel as EventListener],
      ['pointerleave', on.pointerleave as EventListener],
    ];
    for (const [type, fn] of listeners) el.addEventListener(type, fn);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      for (const [type, fn] of listeners) el.removeEventListener(type, fn);
      el.removeEventListener('wheel', wheel);
    };
  }, [canvasRef, controlRef]);
}
