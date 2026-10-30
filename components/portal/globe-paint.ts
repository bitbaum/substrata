/**
 * Substrata's colours for the globe, read from the --map-* tokens
 * (app/globals.css), and each country's fill for the painted layer. The
 * painting itself is the fleet's renderer (`@bitbaum/geo-kit/map`); the
 * figures, sites and routes drawn over it are globe-marks.ts and
 * globe-overlay.ts, which read the extra colours here.
 */
import { fade, type Fill, type Palette as MapPalette } from '@bitbaum/geo-kit/map';

/** Bin 6: USGS printed a word, not a number — hatched, never on the ramp. */
export const HATCHED = 6;

export interface Palette extends MapPalette {
  sphereLight: string;
  graticule: string;
  glow: [string, string];
  limb: [string, string];
  seq: string[];
  /** Callout text and its backing, so a figure reads over any shade of land. */
  label: string;
  labelBack: string;
  labelFont: string;
  /** A supply route's arc, under its moving light. */
  route: string;
  /** A producer site: an ink rim around a page-coloured dot, legible on any shade. */
  site: string;
  siteFill: string;
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
    glow: [fade(atmosphere, 0.38), fade(atmosphere, 0)],
    limb: [fade(limb, 0), fade(limb, 0.55)],
    hover: fade(accent, 0.7),
    selected: fade(accent, 1),
    label: v('--color-fg-primary'),
    labelBack: fade(v('--color-surface-page'), 0.82),
    labelFont: `500 12px ${v('--font-mono') || 'ui-monospace, monospace'}`,
    route: fade(accent, 0.42),
    site: v('--color-fg-primary'),
    siteFill: v('--color-surface-page'),
  };
}

function hatch(ctx: CanvasRenderingContext2D, p: Palette): Fill {
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

/**
 * Each country's fill for the layer's bins, lowest bin first so the renderer
 * paints the ramp in order: one colour per step, the hatch for a word.
 */
export function fillsFor(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  bins: Record<string, number>,
): Map<string, Fill> {
  const pattern = Object.values(bins).includes(HATCHED) ? hatch(ctx, palette) : null;
  return new Map(
    Object.entries(bins)
      .filter(([, bin]) => (bin >= 1 && bin <= 5) || bin === HATCHED)
      .sort(([, a], [, b]) => a - b)
      .map(([iso, bin]) => [iso, bin === HATCHED && pattern ? pattern : palette.seq[bin - 1]]),
  );
}
