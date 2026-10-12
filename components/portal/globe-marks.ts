/**
 * What the globe draws on top of the land: the figures at the countries that
 * matter most for the painted layer, and the ring that opens from a country
 * as the globe flies to it. Kept apart from globe-paint.ts, which paints the
 * Earth itself; these are annotations on it.
 */
import { focusOf, type CountryFeature } from './globe-geo';
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
  // Callouts: a dot at the country and its figure beside it, only on the
  // near face and away from the limb, where a label would smear. The name
  // comes from the feature, so the layer only ever says "cl: 19%".
  if (marks.callouts?.length) {
    ctx.font = palette.labelFont;
    ctx.textBaseline = 'middle';
    for (const { feature, text } of marks.callouts) {
      const [lon, lat] = anchorOf(feature);
      const [x, y, depth] = project(basis, lon, lat);
      if (depth < 0.25) continue;
      const fade = Math.min((depth - 0.25) / 0.2, 1);
      const line = `${feature.properties.name} · ${text}`;
      const w = ctx.measureText(line).width;
      ctx.globalAlpha = fade;
      ctx.fillStyle = palette.selected;
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, FULL);
      ctx.fill();
      ctx.strokeStyle = palette.selected;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 3, y);
      ctx.lineTo(x + 10, y);
      ctx.stroke();
      ctx.fillStyle = palette.labelBack;
      ctx.fillRect(x + 11, y - 9, w + 10, 18);
      ctx.fillStyle = palette.label;
      ctx.fillText(line, x + 16, y);
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
