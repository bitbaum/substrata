/**
 * What the globe draws on top of the land: the figures at the countries that
 * matter most for the painted layer, and the ring that opens from a country
 * as the globe flies to it. Kept apart from globe-paint.ts, which paints the
 * Earth itself; these are annotations on it.
 */
import { focusOf, type CountryFeature } from './globe-geo';
import { paintOverlay, type Overlay } from './globe-overlay';
import type { Palette } from './globe-paint';
import { project, type Basis } from './globe-trace';

const FULL = Math.PI * 2;

export interface GlobeMarks {
  hover?: CountryFeature;
  selected?: CountryFeature;
  /** Figures at the countries that matter most for this layer. */
  callouts?: { feature: CountryFeature; text: string }[];
  /** A ring opening from a just-picked country; t runs 0 → 1 with the flight. */
  pulse?: { feature: CountryFeature; t: number };
  /** Producer sites and supply routes (globe-overlay.ts). */
  overlay?: Overlay;
  /** The clock for the routes' moving light; null holds it still. */
  now?: number | null;
}

/** A country's anchor on the globe, computed once: its mainland's centroid. */
const ANCHORS = new Map<string, [number, number]>();
function anchorOf(f: CountryFeature): [number, number] {
  const hit = ANCHORS.get(f.properties.iso);
  if (hit) return hit;
  const a = focusOf(f).center;
  ANCHORS.set(f.properties.iso, a);
  return a;
}

/** Callouts and the pulse, in CSS pixels, after the land and outlines. */
export function paintMarks(
  ctx: CanvasRenderingContext2D,
  basis: Basis,
  palette: Palette,
  marks: GlobeMarks,
) {
  if (marks.overlay) paintOverlay(ctx, basis, palette, marks.overlay, marks.now ?? null);
  // Callouts: a dot at the country and its figure beside it, only on the
  // near face and away from the limb, where a label would smear. The name
  // comes from the feature, so the layer only ever says "cl: 19%".
  if (marks.callouts?.length) {
    ctx.font = palette.labelFont;
    ctx.textBaseline = 'middle';
    // First come, first placed: a label that would sit on one already drawn
    // steps down a line, and after three tries keeps only its dot. Callouts
    // arrive most important first, so the one that gives way is the lesser.
    const taken: [number, number, number, number][] = [];
    const clear = (x: number, y: number, w: number) =>
      !taken.some(([tx, ty, tw]) => x < tx + tw && x + w > tx && Math.abs(y - ty) < 19);
    for (const { feature, text } of marks.callouts) {
      const [lon, lat] = anchorOf(feature);
      const [x, y, depth] = project(basis, lon, lat);
      if (depth < 0.25) continue;
      const fade = Math.min((depth - 0.25) / 0.2, 1);
      const line = `${feature.properties.name} · ${text}`;
      const w = ctx.measureText(line).width + 10;
      // Past the globe's right edge a label would run under the panel: it
      // sits to the left of its dot instead.
      const left = x + 11 + w > basis.cx + basis.r + 8;
      const lx = left ? x - 11 - w : x + 11;
      let ly = y;
      let tries = 0;
      while (!clear(lx, ly, w) && tries < 3) {
        ly += 20;
        tries += 1;
      }
      ctx.globalAlpha = fade;
      ctx.fillStyle = palette.selected;
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, FULL);
      ctx.fill();
      if (!clear(lx, ly, w)) {
        ctx.globalAlpha = 1;
        continue;
      }
      taken.push([lx, ly, w, 18]);
      ctx.strokeStyle = palette.selected;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left ? x - 3 : x + 3, y);
      ctx.lineTo(left ? lx + w : lx - 1, ly);
      ctx.stroke();
      ctx.fillStyle = palette.labelBack;
      ctx.fillRect(lx, ly - 9, w, 18);
      ctx.fillStyle = palette.label;
      ctx.fillText(line, lx + 5, ly);
      ctx.globalAlpha = 1;
    }
  }

  // The pulse: one ring that opens from the picked country and fades out as
  // the flight lands, so the eye is taken to where the globe is going.
  if (marks.pulse && marks.pulse.t >= 0 && marks.pulse.t < 1) {
    const [lon, lat] = anchorOf(marks.pulse.feature);
    const [x, y, depth] = project(basis, lon, lat);
    if (depth > 0) {
      const t = marks.pulse.t;
      ctx.globalAlpha = (1 - t) * 0.9;
      ctx.strokeStyle = palette.selected;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 6 + 44 * t, 0, FULL);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}
