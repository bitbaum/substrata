/**
 * How the globe moves, pure so it can be tested: a drag turns it, a flight
 * carries it from one view to another the short way round, and a flick keeps
 * it turning for a moment after release.
 */
import { geoDistance, geoInterpolate } from 'd3-geo';

import { MIN_ZOOM, clampTilt, wrapLon, type Camera } from './globe-geo';

/**
 * Turning the globe by a drag of (dx, dy) pixels: the land under the finger
 * follows it at the centre of the disc, whatever the zoom. North stays up.
 */
export function dragged(camera: Camera, dx: number, dy: number, radius: number): Camera {
  const perPixel = 180 / (Math.PI * radius * camera.k);
  // Near the poles a pixel is more longitude; ease it so a drag there does not whip.
  const lonScale = 1 / Math.max(Math.cos((camera.center[1] * Math.PI) / 180), 0.35);
  return {
    center: [
      wrapLon(camera.center[0] - dx * perPixel * Math.min(lonScale, 2)),
      clampTilt(camera.center[1] + dy * perPixel),
    ],
    k: camera.k,
  };
}

export interface Flight {
  at: (t: number) => Camera;
  /** Milliseconds: longer the farther it turns, never a slog. */
  duration: number;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * From one view to another along the great circle — the short way round, so
 * Fiji to Samoa crosses the date line instead of circling the globe — pulling
 * back mid-way on a long turn so the reader sees where they are going.
 */
export function flight(from: Camera, to: Camera): Flight {
  const arc = (geoDistance(from.center, to.center) * 180) / Math.PI;
  const along = geoInterpolate(from.center, to.center);
  const pull = Math.min(Math.max((arc - 30) / 150, 0), 0.45);
  return {
    duration: Math.round(450 + Math.min(arc, 180) * 4),
    at(t) {
      const e = ease(Math.min(Math.max(t, 0), 1));
      const [lon, lat] = along(e);
      const k = from.k + (to.k - from.k) * e;
      const dip = 1 - pull * Math.sin(Math.PI * e);
      return { center: [wrapLon(lon), clampTilt(lat)], k: Math.max(k * dip, MIN_ZOOM) };
    },
  };
}

/** A flick: px/ms along each axis, carried on after the finger lifts. */
export interface Spin {
  vx: number;
  vy: number;
}

/** One frame of coasting: turn by the velocity, then let it decay. */
export function coast(
  camera: Camera,
  spin: Spin,
  dt: number,
  radius: number,
): { camera: Camera; spin?: Spin } {
  const next = dragged(camera, spin.vx * dt, spin.vy * dt, radius);
  const decay = Math.exp(-dt / 325);
  const left = { vx: spin.vx * decay, vy: spin.vy * decay };
  return { camera: next, spin: Math.hypot(left.vx, left.vy) < 0.01 ? undefined : left };
}
