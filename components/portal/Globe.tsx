'use client';

/**
 * The world as a globe: Natural Earth 1:50m on an orthographic projection,
 * painted on one <canvas> by the layer the server chose (app/atlas/
 * map-layer.ts). Drag turns it (with inertia), wheel and pinch zoom, a click
 * turns the country to face the reader and opens its panel. With nothing
 * picked and nobody touching it, it turns slowly — never under
 * prefers-reduced-motion.
 *
 * Canvas 2D, not WebGL: 240 filled outlines are a few thousand path segments
 * a frame, which a phone's 2D canvas draws inside a frame budget, and it runs
 * everywhere a browser runs this page — so there is no second, flat map to
 * fall back to. Drawn only when something changes; idle, it costs nothing.
 *
 * The Earth, its movement, input and picking are the fleet's one map
 * renderer (`@bitbaum/geo-kit/map`, which Solon's map of communes draws with
 * too). What is Substrata's: the countries keyed by ISO code (globe-geo), the
 * colours and the layer's fills (globe-paint), the sites and routes
 * (globe-overlay) and the figures and pulse (globe-marks), drawn over the
 * Earth each frame. This file wires them to the page: selection, the text
 * alternative, the zoom buttons and the hover card.
 * Every country is also reachable by name in the panel's search, which is
 * how Malta or Singapore are reached on a phone.
 */
import { useEffect, useRef, useState } from 'react';

import {
  cameraFor,
  clampTilt,
  focusOf,
  loadWorld,
  type CountryFeature,
  type World,
} from './globe-geo';
import { useGlobeRenderer, type Hover } from './globe-renderer';
import { useMapView } from './map-view';
import type { WorldMapProps } from './WorldMap';

/**
 * Where to face a route from: the mean of the countries on it, so as much of
 * it as one side of the Earth can hold is in view. A route spread all the way
 * round has no such side (the mean falls near the Earth's centre); then null,
 * and the globe faces the bottleneck's own country instead.
 */
function routeCentre(
  routes: { from: string; to: string }[],
  byIso: Map<string, CountryFeature>,
): [number, number] | null {
  let x = 0;
  let y = 0;
  let z = 0;
  let n = 0;
  for (const iso of new Set(routes.flatMap((r) => [r.from, r.to]))) {
    const f = byIso.get(iso);
    if (!f) continue;
    const [lon, lat] = focusOf(f).center.map((d) => (d * Math.PI) / 180);
    x += Math.cos(lat) * Math.cos(lon);
    y += Math.cos(lat) * Math.sin(lon);
    z += Math.sin(lat);
    n += 1;
  }
  if (n === 0) return null;
  const r = Math.hypot(x, y, z) / n;
  if (r < 0.35) return null;
  const lon = (Math.atan2(y, x) * 180) / Math.PI;
  const lat = (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI;
  return [lon, clampTilt(lat * 0.7)];
}

export default function Globe({
  selected,
  keep,
  bins,
  labels,
  callouts,
  otherwise,
  summary,
  sites,
  site,
  routes,
}: WorldMapProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [world, setWorld] = useState<World | null>(null);
  const [failed, setFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [hover, setHover] = useState<Hover | null>(null);
  const [facing, setFacing] = useState('');

  useEffect(() => {
    let active = true;
    loadWorld().then(
      (loaded) => {
        if (active) setWorld(loaded);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [loadAttempt]);

  const frame = useMapView(wrap);
  const { mapRef, byIso } = useGlobeRenderer({
    canvasRef,
    world,
    frame,
    bins,
    selected,
    callouts,
    keep,
    sites,
    site,
    routes,
    setHover,
    setFacing,
  });

  // Face the selected country: at once on first draw, by a flight after.
  // With no country picked but a resource painted, face where it comes from:
  // the largest producer, the whole globe in view. Lithium used to open on
  // Europe with Australia and Chile on the far side, so the map showed the
  // resource everywhere except where it is.
  const faced = useRef<string | null>(null);
  const lead = callouts?.[0]?.iso ?? '';
  const opened = site ? sites?.find((s) => s.id === site) : undefined;
  useEffect(() => {
    const map = mapRef.current;
    const key = opened
      ? `site:${opened.id}`
      : selected
        ? `country:${selected}`
        : routes?.length
          ? `route:${routes.length}:${lead}`
          : lead
            ? `lead:${lead}`
            : '';
    if (!world || !map || faced.current === key) return;
    const first = faced.current === null;
    faced.current = key;
    const target = selected ? byIso.current.get(selected) : undefined;
    const top = !selected && lead ? byIso.current.get(lead) : undefined;
    const c = map.camera();
    // A site is a point, not a country: come in close, so its neighbours
    // separate into their own dots.
    const span = !selected && routes?.length ? routeCentre(routes, byIso.current) : null;
    const to = opened
      ? { center: [opened.lon, clampTilt(opened.lat)] as [number, number], k: 3 }
      : span
        ? { center: span, k: 1 }
        : target
          ? cameraFor(target)
          : top
            ? {
                center: [focusOf(top).center[0], clampTilt(focusOf(top).center[1] * 0.6)] as [
                  number,
                  number,
                ],
                k: 1,
              }
            : { center: c.center, k: Math.min(c.k, 1) };
    if (first) map.jumpTo(to);
    else map.flyTo(to);
  }, [world, selected, lead, opened, routes, mapRef, byIso]);

  const chosen = selected ? world?.countries.find((c) => c.id === selected) : undefined;

  return (
    <div ref={wrap} className="wm" data-loading={!world || undefined}>
      <canvas
        ref={canvasRef}
        className="wm-globe"
        style={{ width: frame?.width ?? 0, height: frame?.height ?? 0 }}
        role="application"
        aria-roledescription="globe"
        aria-label={`Globe${chosen ? `, facing ${chosen.properties.name}` : ''}. Arrow keys turn it, plus and minus zoom, Home shows the whole globe, Enter opens the country facing you. Every country is also in the list in the panel.`}
        aria-describedby="wm-summary"
        tabIndex={0}
      />
      <p id="wm-summary" className="sr-only">
        {summary}
      </p>
      <p className="wm-attribution">
        Map view:{' '}
        <a
          href="https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Natural Earth
        </a>{' '}
        (de facto). Contains identifier data from{' '}
        <a href="https://github.com/mledoze/countries" target="_blank" rel="noopener noreferrer">
          world-countries
        </a>
        ; the <a href="/geo/countries-50m.json">map data</a> is available under{' '}
        <a
          href="https://opendatacommons.org/licenses/odbl/1-0/"
          target="_blank"
          rel="noopener noreferrer"
        >
          ODbL-1.0
        </a>
        . <a href="/geo/ATTRIBUTION.txt">Details</a>.
      </p>
      <p className="sr-only" aria-live="polite">
        {facing && `Facing ${facing}`}
      </p>
      {hover && (
        <div className="wm-tip" style={{ left: hover.x, top: hover.y }} aria-hidden>
          <strong>{hover.name}</strong>
          {hover.site ? (
            <span>Click for the facilities</span>
          ) : (
            (labels[hover.iso] ?? otherwise) && <span>{labels[hover.iso] ?? otherwise}</span>
          )}
        </div>
      )}
      {failed && (
        <div className="wm-failed" role="alert">
          <p>The globe could not load. The country list still works.</p>
          <button
            type="button"
            className="wm-retry"
            onClick={() => {
              setFailed(false);
              setLoadAttempt((attempt) => attempt + 1);
            }}
          >
            Retry globe
          </button>
        </div>
      )}
      <div className="wm-zoom" role="group" aria-label="Zoom">
        <button type="button" onClick={() => mapRef.current?.zoomBy(1.5)} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => mapRef.current?.zoomBy(1 / 1.5)} aria-label="Zoom out">
          −
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomBy('home')}
          aria-label="Show the whole globe"
        >
          ⟲
        </button>
      </div>
    </div>
  );
}
