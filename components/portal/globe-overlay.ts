/**
 * What the globe draws about the world's economy rather than its borders:
 *
 * - Sites: where a resource is actually produced — a mine, a smelter, a
 *   refinery — one dot per location USGS prints. A dot is solid when
 *   OpenStreetMap confirmed the facility or its town, and an open ring when
 *   only the province is known, so the drawing never claims more precision
 *   than the source has.
 * - Routes: a supply chain laid over the Earth. One arc per hop, from where an
 *   input is made to where the thing that needs it is made, lifted off the
 *   surface so crossings read, with a chevron for direction and, unless the
 *   reader asked for less motion, a light that runs along it input to output.
 *
 * Pure drawing and picking against the view's basis (globe-trace.ts); the
 * frame loop decides when to call it.
 */
import { geoDistance, geoInterpolate, type GeoProjection } from 'd3-geo';

import { centreOf } from './globe-cull';
import type { Palette } from './globe-paint';
import { basisOf, pack, project, type Basis, type Packed } from './globe-trace';

const FULL = Math.PI * 2;
/** Samples per arc: smooth at full zoom, cheap at 25 arcs. */
const SAMPLES = 48;
/** How long the light takes to run one arc. */
const RUN_MS = 2600;

export type SitePrecision = 'site' | 'town' | 'region';

export interface SitePoint {
  id: string;
  lon: number;
  lat: number;
  precision: SitePrecision;
  /** The hover line: the companies and the place. */
  label: string;
}

/** A hop of a route, resolved to coordinates by the loop. */
export interface RouteArc {
  key: string;
  from: [number, number];
  to: [number, number];
  /** The arc's shape, sampled once: unit vectors and how far it rises. */
  path: Packed;
  lift: Float64Array;
  /** Where along the run this arc's light starts, so they do not march in step. */
  phase: number;
}

export interface Overlay {
  sites: SitePoint[];
  site?: string;
  hoverSite?: string;
  arcs: RouteArc[];
}

export const EMPTY_OVERLAY: Overlay = { sites: [], arcs: [] };

/** A great-circle hop, sampled and lifted: the longer the hop, the higher it rises. */
export function arcOf(key: string, from: [number, number], to: [number, number]): RouteArc {
  const at = geoInterpolate(from, to);
  const span = geoDistance(from, to); // radians
  // Low enough that an arc never leaves the globe's disc: a curve floating in
  // space beside the Earth reads as decoration, not a route.
  const rise = 0.025 + Math.min(span / Math.PI, 1) * 0.06;
  const coords: [number, number][] = [];
  const lift = new Float64Array(SAMPLES);
  for (let i = 0; i < SAMPLES; i += 1) {
    const t = i / (SAMPLES - 1);
    coords.push(at(t));
    lift[i] = 1 + rise * Math.sin(Math.PI * t);
  }
  let seed = 0;
  for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) % 997;
  return { key, from, to, path: pack(coords), lift, phase: seed / 997 };
}

/** Screen position of sample i, or null when the globe hides it. */
function sample(b: Basis, arc: RouteArc, i: number): [number, number] | null {
  const x = arc.path[i * 3];
  const y = arc.path[i * 3 + 1];
  const z = arc.path[i * 3 + 2];
  const u = (b.e[0] * x + b.e[1] * y + b.e[2] * z) * arc.lift[i];
  const v = (b.n[0] * x + b.n[1] * y + b.n[2] * z) * arc.lift[i];
  const depth = b.f[0] * x + b.f[1] * y + b.f[2] * z;
  if (depth < 0) return null;
  return [b.cx + b.r * u, b.cy - b.r * v];
}

function strokeArc(ctx: CanvasRenderingContext2D, b: Basis, arc: RouteArc, i0: number, i1: number) {
  ctx.beginPath();
  let down = false;
  for (let i = i0; i <= i1; i += 1) {
    const p = sample(b, arc, i);
    if (!p) {
      down = false;
      continue;
    }
    if (down) ctx.lineTo(p[0], p[1]);
    else ctx.moveTo(p[0], p[1]);
    down = true;
  }
  ctx.stroke();
}

function chevron(ctx: CanvasRenderingContext2D, b: Basis, arc: RouteArc, i: number) {
  const a = sample(b, arc, i - 1);
  const c = sample(b, arc, i + 1);
  if (!a || !c) return;
  const angle = Math.atan2(c[1] - a[1], c[0] - a[0]);
  const [x, y] = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(angle - 2.6) * 6, y + Math.sin(angle - 2.6) * 6);
  ctx.lineTo(x, y);
  ctx.lineTo(x + Math.cos(angle + 2.6) * 6, y + Math.sin(angle + 2.6) * 6);
  ctx.stroke();
}

/** Arcs under the sites, sites under the callouts (painted after, in globe-marks). */
export function paintOverlay(
  ctx: CanvasRenderingContext2D,
  b: Basis,
  palette: Palette,
  overlay: Overlay,
  now: number | null,
) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const arc of overlay.arcs) {
    ctx.strokeStyle = palette.route;
    ctx.lineWidth = 1.5;
    strokeArc(ctx, b, arc, 0, SAMPLES - 1);
    ctx.strokeStyle = palette.selected;
    ctx.lineWidth = 1.25;
    chevron(ctx, b, arc, Math.round(SAMPLES * 0.62));
    if (now !== null) {
      // The light: a short bright run that travels input to output.
      const t = (now / RUN_MS + arc.phase) % 1;
      const head = Math.round(t * (SAMPLES - 1));
      ctx.strokeStyle = palette.selected;
      ctx.lineWidth = 2.25;
      strokeArc(ctx, b, arc, Math.max(0, head - 6), head);
    }
  }
  for (const s of overlay.sites) {
    const [x, y, depth] = project(b, s.lon, s.lat);
    if (depth < 0.05) continue;
    const lit = s.id === overlay.site || s.id === overlay.hoverSite;
    ctx.globalAlpha = Math.min(depth / 0.2, 1);
    ctx.beginPath();
    if (s.precision === 'region') {
      ctx.arc(x, y, lit ? 7 : 5, 0, FULL);
      ctx.strokeStyle = palette.site;
      ctx.lineWidth = lit ? 2 : 1.25;
      ctx.stroke();
    } else {
      // Light with an ink rim: reads on bare land and on the darkest band.
      ctx.arc(x, y, lit ? 5 : 3.25, 0, FULL);
      ctx.fillStyle = palette.siteFill;
      ctx.fill();
      ctx.strokeStyle = palette.site;
      ctx.lineWidth = 1.25;
      ctx.stroke();
    }
    if (s.id === overlay.site) {
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, FULL);
      ctx.strokeStyle = palette.selected;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

/** The site under the pointer, within a finger's reach, nearest first. */
export function pickSite(
  sites: SitePoint[],
  proj: GeoProjection,
  x: number,
  y: number,
  reach = 12,
): SitePoint | null {
  if (sites.length === 0) return null;
  const [cx, cy] = proj.translate();
  const b = basisOf(centreOf(proj), cx, cy, proj.scale());
  let best: SitePoint | null = null;
  let bestD = reach;
  for (const s of sites) {
    const [px, py, depth] = project(b, s.lon, s.lat);
    if (depth < 0.05) continue;
    const d = Math.hypot(px - x, py - y);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}
