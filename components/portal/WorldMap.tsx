'use client';

/**
 * The world, as a full-bleed vector map: Natural Earth 1:50m on the Equal
 * Earth projection, painted by the layer the server chose (app/atlas/
 * map-layer.ts), with wheel / pinch / drag / keyboard zoom and a selected
 * outline.
 *
 * Countries are pointer targets, not tab stops — 240 of them in the tab order
 * would bury the page. The keyboard gets the map as one control (+ − 0 and the
 * arrows) and every country by name through the panel's search, which is also
 * how Malta or Singapore are reached on a phone.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { select } from 'd3-selection';
import 'd3-transition';
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';

import {
  MAX_ZOOM,
  focusTransform,
  homeScale,
  homeTransform,
  inView,
  loadCountries,
  pathsFor,
  type CountryFeature,
} from './world-map-geo';
import { useMapView } from './map-view';

export interface WorldMapProps {
  selected?: string;
  /** Query parameters a click on a country keeps (resource, measure). */
  keep: Record<string, string>;
  /** Bin per ISO code: 1–5 up the sequential scale; absent = nothing recorded. */
  bins: Record<string, number>;
  labels: Record<string, string>;
  /** The hover line for a country with no row in this layer. */
  otherwise?: string;
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function WorldMap({ selected, keep, bins, labels, otherwise }: WorldMapProps) {
  const router = useRouter();
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const layer = useRef<SVGGElement>(null);
  const behaviour = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [features, setFeatures] = useState<CountryFeature[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<{ iso: string; name: string; x: number; y: number } | null>(
    null,
  );

  useEffect(() => {
    loadCountries().then(setFeatures, () => setFailed(true));
  }, []);

  // The canvas and the part of it nothing covers (map-view.ts).
  const frame = useMapView(wrap);
  const width = frame?.width ?? 0;
  const view = frame?.view;
  // Until the reader pans or zooms, the map follows the sheet and the panel;
  // after that it stays where they put it.
  const moved = useRef(false);

  const drawn = useMemo(
    () => (features && width > 0 ? pathsFor(features, width) : null),
    [features, width],
  );

  // One zoom behaviour per projection; it writes the transform straight to
  // the layer so a pinch never re-renders 240 paths.
  useEffect(() => {
    if (!svg.current || !drawn || !frame) return;
    const [[x0, y0], [x1, y1]] = drawn.frameBounds;
    const minK = Math.min(1, homeScale(frame.view, drawn.frameBounds));
    // Room to move the world into the visible part — below the bar, above a
    // raised sheet, left of the panel — but never all the way off the canvas.
    const padX = frame.width / (2 * minK);
    const padY = frame.height / (2 * minK);
    const zoom = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([minK, MAX_ZOOM])
      .translateExtent([
        [x0 - padX, y0 - padY],
        [x1 + padX, y1 + padY],
      ])
      .clickDistance(6)
      .on('zoom', (event: { transform: ZoomTransform; sourceEvent: unknown }) => {
        layer.current?.setAttribute('transform', event.transform.toString());
        if (event.sourceEvent) moved.current = true;
        setHover(null);
      });
    behaviour.current = zoom;
    const root = select(svg.current);
    root.call(zoom);
    return () => {
      root.on('.zoom', null);
    };
    // A new behaviour only when the projection or the canvas changes size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawn, frame?.width, frame?.height]);

  // Frame the world, or the selected country, in the visible part: on first
  // draw, on a new selection, and when the sheet or panel changes what is
  // visible. Once the reader has panned or zoomed, a change of sheet only
  // brings the country back if it has left the visible part.
  const framed = useRef<{ drawn: typeof drawn; selected?: string }>({ drawn: null });
  useEffect(() => {
    const zoom = behaviour.current;
    if (!svg.current || !zoom || !drawn || !view) return;
    // A full sheet leaves a sliver: leave the map as it was underneath and
    // frame it again when the sheet comes down.
    if (view.y1 - view.y0 < 96) return;
    // A new projection (a new width) makes the current transform meaningless.
    const fresh = framed.current.drawn !== drawn;
    const picked = framed.current.selected !== selected;
    const root = select(svg.current);
    const target = selected ? drawn.countries.find((c) => c.iso === selected) : undefined;
    const now = (root.property('__zoom') as ZoomTransform | undefined) ?? zoomIdentity;
    const free = fresh || picked || !moved.current;
    if (target && !free && inView(view, target.bounds, now)) return;
    if (!target && !free) return;
    const next = target
      ? focusTransform(view, target.bounds, drawn.frameBounds)
      : homeTransform(view, drawn.frameBounds);
    framed.current = { drawn, selected };
    moved.current = false;
    if (fresh || reducedMotion()) root.call(zoom.transform, next);
    else root.transition().duration(600).call(zoom.transform, next);
  }, [selected, drawn, view]);

  const step = useCallback(
    (factor: number | 'home') => {
      const zoom = behaviour.current;
      if (!svg.current || !zoom || !drawn || !view) return;
      const root = select(svg.current);
      const run = reducedMotion() ? root : root.transition().duration(250);
      if (factor === 'home') {
        moved.current = false;
        run.call(zoom.transform, homeTransform(view, drawn.frameBounds));
      } else {
        moved.current = true;
        run.call(zoom.scaleBy, factor);
      }
    },
    [drawn, view],
  );

  const pan = useCallback((dx: number, dy: number) => {
    const zoom = behaviour.current;
    if (!svg.current || !zoom) return;
    moved.current = true;
    select(svg.current).call(zoom.translateBy, dx, dy);
  }, []);

  function open(iso: string) {
    if (!iso) return;
    const params = new URLSearchParams({ view: 'world', ...keep, country: iso });
    router.push(`/atlas?${params.toString()}`, { scroll: false });
  }

  const chosen = selected ? drawn?.countries.find((c) => c.iso === selected) : undefined;

  return (
    <div ref={wrap} className="wm" data-loading={!drawn || undefined}>
      <svg
        ref={svg}
        className="wm-svg"
        width={frame?.width ?? 0}
        height={frame?.height ?? 0}
        role="application"
        aria-roledescription="map"
        aria-label="World map. Plus and minus zoom, arrow keys pan, Home resets. Find a country by name in the panel."
        tabIndex={0}
        onKeyDown={(e) => {
          const keys: Record<string, () => void> = {
            '+': () => step(1.6),
            '=': () => step(1.6),
            '-': () => step(1 / 1.6),
            '0': () => step('home'),
            Home: () => step('home'),
            ArrowLeft: () => pan(60, 0),
            ArrowRight: () => pan(-60, 0),
            ArrowUp: () => pan(0, 60),
            ArrowDown: () => pan(0, -60),
          };
          const run = keys[e.key];
          if (!run) return;
          e.preventDefault();
          run();
        }}
        onPointerLeave={() => setHover(null)}
      >
        {drawn && (
          <g ref={layer}>
            <defs>
              {/* USGS printed a word, not a number: hatched, never a step on the ramp. */}
              <pattern id="wm-hatch" width="4" height="4" patternUnits="userSpaceOnUse">
                <rect className="wm-hatch-bg" width="4" height="4" />
                <path className="wm-hatch-line" d="M-1 1l2-2M0 4l4-4M3 5l2-2" />
              </pattern>
            </defs>
            <path className="wm-sphere" d={drawn.sphere} />
            {drawn.countries.map((c, i) => (
              <path
                key={`${c.iso || c.name}-${i}`}
                d={c.d}
                className="wm-land"
                data-bin={bins[c.iso] ?? 0}
                data-open={c.iso ? '' : undefined}
                onPointerMove={(e) => {
                  if (e.pointerType !== 'mouse') return;
                  const box = wrap.current?.getBoundingClientRect();
                  if (!box) return;
                  setHover({
                    iso: c.iso,
                    name: c.name,
                    x: e.clientX - box.left,
                    y: e.clientY - box.top,
                  });
                }}
                onClick={() => open(c.iso)}
              />
            ))}
            {hover && hover.iso !== selected && (
              <path className="wm-hover" d={drawn.countries.find((c) => c.iso === hover.iso)?.d} />
            )}
            {chosen && <path className="wm-selected" d={chosen.d} />}
          </g>
        )}
      </svg>
      {hover && (
        <div className="wm-tip" style={{ left: hover.x, top: hover.y }} aria-hidden>
          <strong>{hover.name}</strong>
          {(labels[hover.iso] ?? otherwise) && <span>{labels[hover.iso] ?? otherwise}</span>}
        </div>
      )}
      {failed && <p className="wm-failed">The map could not load. The country list still works.</p>}
      <div className="wm-zoom" role="group" aria-label="Zoom">
        <button type="button" onClick={() => step(1.6)} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => step(1 / 1.6)} aria-label="Zoom out">
          −
        </button>
        <button type="button" onClick={() => step('home')} aria-label="Show the whole world">
          ⟲
        </button>
      </div>
    </div>
  );
}
