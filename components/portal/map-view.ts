'use client';

/**
 * Which part of the map canvas the reader can actually see: below the atlas
 * bar, above the bottom sheet and the legend lying on the map, left of the
 * desktop panel. Measured from the elements themselves rather than from CSS
 * arithmetic, because the bar wraps on a phone, the legend's height depends on
 * the resource, and the sheet has three snaps — an estimate of any of them
 * put the world in a strip half under the sheet.
 */
import { useLayoutEffect, useState, type RefObject } from 'react';

import type { View } from './globe-geo';

/** Breathing room between the map and whatever covers it. */
const GAP = 8;

function shown(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none' && el.offsetHeight > 0;
}

export function measureView(canvas: HTMLElement): View {
  const stage = canvas.closest('.atlas') ?? canvas.parentElement ?? canvas;
  const c = canvas.getBoundingClientRect();
  const view: View = { x0: 0, y0: 0, x1: c.width, y1: c.height };
  const bar = stage.querySelector('.atlas-bar');
  if (shown(bar)) view.y0 = Math.max(view.y0, bar.getBoundingClientRect().bottom - c.top + GAP);
  const sheet = stage.querySelector('.atlas-sheet');
  if (shown(sheet)) {
    const r = sheet.getBoundingClientRect();
    // A sheet spans the bottom; the desktop panel stands at the right.
    if (r.width > c.width * 0.6) view.y1 = Math.min(view.y1, r.top - c.top - GAP);
    else view.x1 = Math.min(view.x1, r.left - c.left - GAP);
  }
  // The legend lies on the map; where it spans most of the width (a phone,
  // a tablet) the world is framed above it, where it is a card in a corner
  // (a desktop) the map may pass under it.
  const legend = stage.querySelector('.map-legend');
  if (shown(legend)) {
    const r = legend.getBoundingClientRect();
    if (r.width > (view.x1 - view.x0) * 0.45) view.y1 = Math.min(view.y1, r.top - c.top - GAP);
  }
  // Never collapse: a full sheet leaves a sliver, and the math needs a box.
  view.y1 = Math.max(view.y1, view.y0 + 48);
  view.x1 = Math.max(view.x1, view.x0 + 48);
  return view;
}

function same(a: View | null, b: View): boolean {
  return (
    !!a &&
    Math.abs(a.x0 - b.x0) < 2 &&
    Math.abs(a.y0 - b.y0) < 2 &&
    Math.abs(a.x1 - b.x1) < 2 &&
    Math.abs(a.y1 - b.y1) < 2
  );
}

/**
 * The canvas size and its visible part, re-measured whenever anything that
 * covers the map moves. Settles for a moment first: the sheet animates its
 * height, and one re-frame at the end reads better than thirty on the way.
 */
export function useMapView(canvas: RefObject<HTMLElement | null>) {
  const [state, setState] = useState<{ width: number; height: number; view: View } | null>(null);
  useLayoutEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const stage = el.closest('.atlas') ?? el;
    const read = () =>
      setState((prev) => {
        const next = { width: el.clientWidth, height: el.clientHeight, view: measureView(el) };
        return prev &&
          prev.width === next.width &&
          prev.height === next.height &&
          same(prev.view, next.view)
          ? prev
          : next;
      });
    read();
    let timer = 0;
    const settle = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(read, 90);
    };
    const resize = new ResizeObserver(settle);
    resize.observe(el);
    for (const sel of ['.atlas-bar', '.atlas-sheet', '.map-legend']) {
      const target = stage.querySelector(sel);
      if (target) resize.observe(target);
    }
    // The legend hides when the sheet rises: an attribute, not a resize.
    const snaps = new MutationObserver(settle);
    snaps.observe(stage, { attributes: true, attributeFilter: ['data-sheet'] });
    return () => {
      window.clearTimeout(timer);
      resize.disconnect();
      snaps.disconnect();
    };
  }, [canvas]);
  return state;
}
