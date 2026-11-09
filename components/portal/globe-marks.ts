/**
 * What the globe draws on top of the land: the ring that opens from a country
 * as the globe flies to it, and the sites and routes. The figures at the
 * countries that matter most are the renderer's own labels (calloutLabels),
 * placed, thinned and faded by @bitbaum/geo-kit like every map's names. The Earth itself is painted by the fleet's
 * renderer (`@bitbaum/geo-kit/map`); these are annotations on it, drawn
 * through its `over` hook.
 */
import { project, type Basis, type LabelStyles, type MapLabel } from '@bitbaum/geo-kit/map';

import { focusOf, type CountryFeature } from './globe-geo';
import { paintOverlay, type Overlay } from './globe-overlay';
import type { Palette } from './globe-paint';

/**
 * The figures at the countries that matter most for this layer, as labels:
 * a dot at the country and "name · figure" in a box beside it, joined by a
 * line. They arrive most important first, so the one that gives way is the
 * lesser.
 */
export function calloutLabels(callouts: { feature: CountryFeature; text: string }[]): MapLabel[] {
  return callouts.map(({ feature, text }, i) => ({
    id: `callout:${feature.properties.iso}`,
    text: `${feature.properties.name} · ${text}`,
    at: anchorOf(feature),
    rank: i,
    kind: 'callout',
    dot: true,
  }));
}

export function calloutStyles(palette: Palette): LabelStyles {
  const callout = {
    font: palette.labelFont,
    colour: palette.label,
    halo: palette.labelBack,
    box: palette.labelBack,
    leader: palette.selected,
    dot: palette.selected,
    dotRadius: 2.5,
    padding: 5,
  };
  return { default: callout, callout };
}

const FULL = Math.PI * 2;

export interface GlobeMarks {
  /** A ring opening from a just-picked country; t runs 0 → 1 with the flight. */
  pulse?: { feature: CountryFeature; t: number };
  /** Producer sites and supply routes (globe-overlay.ts). */
  overlay?: Overlay;
  /** The clock for the routes' moving light; null holds it still. */
  now?: number | null;
}

/** A country's anchor on the globe, computed once: its mainland's centroid. */
const ANCHORS = new Map<string, [number, number]>();
export function anchorOf(f: CountryFeature): [number, number] {
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
