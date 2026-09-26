/**
 * Painting the globe on a canvas: the colours read from the --map-* tokens
 * (app/globals.css), the fills grouped so each colour is one path, and one
 * frame drawn — atmosphere, lit sphere, graticule, land, borders, limb shade,
 * then the hover and selection outlines.
 */
import { geoGraticule10, geoPath, type GeoProjection } from 'd3-geo';
import type { MultiLineString } from 'geojson';

import { centreOf, horizonOf, visible } from './globe-cull';
import type { CountryFeature, Shapes } from './globe-geo';
import { basisOf, pack, traceLine, traceRing } from './globe-trace';

/** Bin 6: USGS printed a word, not a number — hatched, never on the ramp. */
export const HATCHED = 6;

export interface Palette {
  sphere: string;
  sphereLight: string;
  graticule: string;
  land: string;
  border: string;
  seq: string[];
  /** Faded once per theme, not per frame: [inner, outer]. */
  glow: [string, string];
  limb: [string, string];
  hover: string;
  selected: string;
}

/**
 * Any CSS colour at an alpha, for gradients that fade without greying. The
 * canvas normalises the colour first: the build minifies `#000000` to `#000`,
 * and a token could as well be `rgb()` — a hex-only parse painted the limb
 * shade opaque black over the whole globe.
 */
function alpha(colour: string, a: number): string {
  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) return colour;
  probe.fillStyle = '#000';
  probe.fillStyle = colour;
  const norm = String(probe.fillStyle);
  const hex = /^#([0-9a-f]{6})$/i.exec(norm);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const rgba = /^rgba?\(([^,]+),([^,]+),([^,)]+)/.exec(norm.replace(/\s/g, ''));
  return rgba ? `rgba(${rgba[1]},${rgba[2]},${rgba[3]},${a})` : colour;
}

export function readPalette(el: Element): Palette {
  const cs = getComputedStyle(el);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  const atmosphere = v('--map-atmosphere');
  const limb = v('--map-limb');
  const accent = v('--color-accent');
  return {
    sphere: v('--map-sphere'),
    sphereLight: v('--map-sphere-light'),
    graticule: v('--map-graticule'),
    land: v('--map-land'),
    border: v('--map-border'),
    seq: [1, 2, 3, 4, 5].map((i) => v(`--map-seq-${i}`)),
    glow: [alpha(atmosphere, 0.38), alpha(atmosphere, 0)],
    limb: [alpha(limb, 0), alpha(limb, 0.55)],
    hover: alpha(accent, 0.7),
    selected: alpha(accent, 1),
  };
}

function hatch(ctx: CanvasRenderingContext2D, p: Palette): CanvasPattern | string {
  const tile = document.createElement('canvas');
  tile.width = tile.height = 6;
  const t = tile.getContext('2d');
  if (!t) return p.seq[2];
  t.fillStyle = p.land;
  t.fillRect(0, 0, 6, 6);
  t.strokeStyle = p.seq[2];
  t.lineWidth = 1.25;
  t.beginPath();
  for (const o of [-6, 0, 6]) {
    t.moveTo(o, 6);
    t.lineTo(o + 6, 0);
  }
  t.stroke();
  return ctx.createPattern(tile, 'repeat') ?? p.seq[2];
}

export interface Paint {
  palette: Palette;
  /**
   * One entry per colour, lowest bin first — a path per colour, not per
   * country — as indexes, so the full and the coarse world share it.
   */
  groups: [string | CanvasPattern, number[]][];
  /** The layers that do not turn with the Earth, rendered once per disc. */
  backdrop?: { key: string; under: HTMLCanvasElement; over: HTMLCanvasElement };
}

export function paintFor(
  ctx: CanvasRenderingContext2D,
  el: Element,
  countries: CountryFeature[],
  bins: Record<string, number>,
): Paint {
  const palette = readPalette(el);
  const fills = new Map<number, number[]>();
  countries.forEach((c, i) => {
    const bin = bins[c.properties.iso] ?? 0;
    fills.set(bin, [...(fills.get(bin) ?? []), i]);
  });
  const colour = (bin: number) =>
    bin === HATCHED
      ? hatch(ctx, palette)
      : bin >= 1 && bin <= 5
        ? palette.seq[bin - 1]
        : palette.land;
  return {
    palette,
    groups: [...fills.entries()].sort(([a], [b]) => a - b).map(([bin, is]) => [colour(bin), is]),
  };
}

const FULL = Math.PI * 2;
const GRATICULE = (geoGraticule10() as MultiLineString).coordinates.map(pack);

function blit(ctx: CanvasRenderingContext2D, layer: HTMLCanvasElement) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
}

/**
 * Atmosphere and lit sphere (under the land) and the limb shade (over it) do
 * not turn with the Earth: render them once per disc and blit them, instead
 * of three full-disc gradients every frame.
 */
function backdrop(
  paint: Paint,
  target: HTMLCanvasElement,
  cx: number,
  cy: number,
  r: number,
  size: { w: number; h: number },
) {
  const key = [target.width, target.height, cx, cy, r].map((n) => n.toFixed(1)).join();
  if (paint.backdrop?.key === key) return paint.backdrop;
  const { palette } = paint;
  const scale = target.width / size.w;
  const layer = (draw: (c: CanvasRenderingContext2D) => void) => {
    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const c = canvas.getContext('2d');
    if (c) {
      c.setTransform(scale, 0, 0, scale, 0, 0);
      draw(c);
    }
    return canvas;
  };
  const disc = (c: CanvasRenderingContext2D, radius: number, fill: CanvasGradient) => {
    c.fillStyle = fill;
    c.beginPath();
    c.arc(cx, cy, radius, 0, FULL);
    c.fill();
  };
  const under = layer((c) => {
    // Atmosphere: a thin glow past the limb, only while the limb is on screen.
    if (r < Math.hypot(size.w, size.h)) {
      const glow = c.createRadialGradient(cx, cy, r * 0.97, cx, cy, r * 1.12);
      glow.addColorStop(0, palette.glow[0]);
      glow.addColorStop(1, palette.glow[1]);
      disc(c, r * 1.12, glow);
    }
    // The sphere, lit from the upper left.
    const sea = c.createRadialGradient(cx - r * 0.4, cy - r * 0.45, r * 0.05, cx, cy, r);
    sea.addColorStop(0, palette.sphereLight);
    sea.addColorStop(1, palette.sphere);
    disc(c, r, sea);
  });
  // Shade toward the limb so it reads as a ball, not a disc.
  const over = layer((c) => {
    const limb = c.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
    limb.addColorStop(0, palette.limb[0]);
    limb.addColorStop(1, palette.limb[1]);
    disc(c, r, limb);
  });
  paint.backdrop = { key, under, over };
  return paint.backdrop;
}

/** One frame, in CSS pixels (the caller has set the device-pixel transform). */
export function paintGlobe(
  ctx: CanvasRenderingContext2D,
  size: { w: number; h: number },
  proj: GeoProjection,
  world: Shapes,
  paint: Paint,
  marks: { hover?: CountryFeature; selected?: CountryFeature },
) {
  const { palette, groups } = paint;
  const path = geoPath(proj, ctx);
  const [cx, cy] = proj.translate();
  const r = proj.scale();
  ctx.clearRect(0, 0, size.w, size.h);
  const { under, over } = backdrop(paint, ctx.canvas, cx, cy, r, size);
  blit(ctx, under);

  const centre = centreOf(proj);
  const horizon = horizonOf(proj, size);
  const basis = basisOf(centre, cx, cy, r);

  ctx.beginPath();
  for (const line of GRATICULE) traceLine(ctx, line, basis);
  ctx.strokeStyle = palette.graticule;
  ctx.lineWidth = 0.5;
  ctx.stroke();

  for (const [fill, members] of groups) {
    ctx.beginPath();
    for (const i of members)
      if (visible(world.caps[i], centre, horizon))
        for (const ring of world.rings[i]) traceRing(ctx, ring, basis);
    ctx.fillStyle = fill;
    ctx.fill('evenodd');
  }
  ctx.beginPath();
  world.lines.forEach((line, i) => {
    if (visible(world.lineCaps[i], centre, horizon)) traceLine(ctx, line, basis);
  });
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 0.6;
  ctx.lineJoin = 'round';
  ctx.stroke();

  blit(ctx, over);

  const outline = (f: CountryFeature | undefined, width: number, colour: string) => {
    if (!f) return;
    ctx.beginPath();
    path(f);
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.stroke();
    // Too small to see at this zoom: ring it.
    const [[x0, y0], [x1, y1]] = path.bounds(f);
    if (Number.isFinite(x0) && Math.max(x1 - x0, y1 - y0) < 10) {
      ctx.beginPath();
      ctx.arc((x0 + x1) / 2, (y0 + y1) / 2, 11, 0, FULL);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  };
  if (marks.hover !== marks.selected) outline(marks.hover, 1.25, palette.hover);
  outline(marks.selected, 2, palette.selected);
}
