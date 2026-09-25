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
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { select } from 'd3-selection';
import 'd3-transition';
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';

import {
  MAX_ZOOM,
  focusTransform,
  homeTransform,
  inView,
  loadCountries,
  pathsFor,
  type CountryFeature,
  type Frame,
} from './world-map-geo';

export interface WorldMapProps {
  selected?: string;
  resource?: string;
  /** Bin per ISO code: 1–5 up the sequential scale; absent = nothing recorded. */
  bins: Record<string, number>;
  labels: Record<string, string>;
}

function readInset(el: HTMLElement, name: string): number {
  const probe = getComputedStyle(el).getPropertyValue(name).trim();
  const px = parseFloat(probe);
  if (!probe || Number.isNaN(px)) return 0;
  return probe.endsWith('rem')
    ? px * parseFloat(getComputedStyle(document.documentElement).fontSize)
    : px;
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function WorldMap({ selected, resource, bins, labels }: WorldMapProps) {
  const router = useRouter();
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const layer = useRef<SVGGElement>(null);
  const behaviour = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [features, setFeatures] = useState<CountryFeature[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [hover, setHover] = useState<{ iso: string; name: string; x: number; y: number } | null>(
    null,
  );

  useEffect(() => {
    loadCountries().then(setFeatures, () => setFailed(true));
  }, []);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () =>
      setFrame({
        width: el.clientWidth,
        height: el.clientHeight,
        inset: {
          top: readInset(el, '--atlas-map-inset-top'),
          right: readInset(el, '--atlas-map-inset-right'),
          bottom: readInset(el, '--atlas-map-inset-bottom'),
        },
      });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const drawn = useMemo(
    () => (features && frame && frame.width > 0 ? pathsFor(features, frame) : null),
    [features, frame],
  );

  // One zoom behaviour per frame size; it writes the transform straight to the
  // layer so a pinch never re-renders 240 paths.
  useEffect(() => {
    if (!svg.current || !drawn || !frame) return;
    const [[x0, y0], [x1, y1]] = drawn.frameBounds;
    const zoom = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, MAX_ZOOM])
      .translateExtent([
        [x0 - 48, y0 - 96],
        [x1 + 48, y1 + 96],
      ])
      .clickDistance(6)
      .on('zoom', (event: { transform: ZoomTransform }) => {
        layer.current?.setAttribute('transform', event.transform.toString());
        setHover(null);
      });
    behaviour.current = zoom;
    const root = select(svg.current);
    root.call(zoom);
    const target = selected && drawn.countries.find((c) => c.iso === selected);
    root.call(
      zoom.transform,
      target ? focusTransform(frame, target.bounds) : homeTransform(frame, drawn.frameBounds),
    );
    return () => {
      root.on('.zoom', null);
    };
    // Re-frame on a new size only; a new selection moves the view below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawn, frame]);

  // A new selection glides to the country unless it is already in view.
  useEffect(() => {
    const zoom = behaviour.current;
    if (!svg.current || !zoom || !drawn || !frame || !selected) return;
    const target = drawn.countries.find((c) => c.iso === selected);
    if (!target) return;
    const root = select(svg.current);
    const now = (root.property('__zoom') as ZoomTransform | undefined) ?? zoomIdentity;
    if (inView(frame, target.bounds, now)) return;
    const next = focusTransform(frame, target.bounds);
    if (reducedMotion()) root.call(zoom.transform, next);
    else root.transition().duration(600).call(zoom.transform, next);
  }, [selected, drawn, frame]);

  const step = useCallback(
    (factor: number | 'home') => {
      const zoom = behaviour.current;
      if (!svg.current || !zoom || !drawn || !frame) return;
      const root = select(svg.current);
      const run = reducedMotion() ? root : root.transition().duration(250);
      if (factor === 'home') run.call(zoom.transform, homeTransform(frame, drawn.frameBounds));
      else run.call(zoom.scaleBy, factor);
    },
    [drawn, frame],
  );

  const pan = useCallback((dx: number, dy: number) => {
    const zoom = behaviour.current;
    if (!svg.current || !zoom) return;
    select(svg.current).call(zoom.translateBy, dx, dy);
  }, []);

  function open(iso: string) {
    if (!iso) return;
    const params = new URLSearchParams({ view: 'world', country: iso });
    if (resource) params.set('resource', resource);
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
        aria-label="World map. Plus and minus zoom, arrow keys pan, 0 resets. Find a country by name in the panel."
        tabIndex={0}
        onKeyDown={(e) => {
          const keys: Record<string, () => void> = {
            '+': () => step(1.6),
            '=': () => step(1.6),
            '-': () => step(1 / 1.6),
            '0': () => step('home'),
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
          {labels[hover.iso] && <span>{labels[hover.iso]}</span>}
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
