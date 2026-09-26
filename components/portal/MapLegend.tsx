/**
 * What the colour on the globe means: the measure and year in the title,
 * the scale's steps, the categorical keys (hatched, not listed), the unit or
 * caveat, and the source — edition and table — it came from.
 */
import Link from 'next/link';

import type { MapLegend as Legend } from '@/app/atlas/map-layer';

export function MapLegend({
  legend,
  measureHref,
}: {
  legend: Legend;
  measureHref?: (measure: string) => string;
}) {
  return (
    <figure className="map-legend">
      <figcaption>{legend.title}</figcaption>
      {legend.measures && measureHref && (
        <nav className="map-measures" aria-label="Measure">
          {legend.measures.map((m) => (
            <Link
              key={m.id}
              href={measureHref(m.id)}
              scroll={false}
              aria-current={m.current ? 'page' : undefined}
            >
              {m.label}
            </Link>
          ))}
        </nav>
      )}
      {legend.scale && (
        <ul className="map-scale">
          {legend.scale.map((stop) => (
            <li key={stop.bin}>
              <span className="map-swatch" data-bin={stop.bin} aria-hidden />
              {stop.label}
            </li>
          ))}
        </ul>
      )}
      {legend.keys.length > 0 && (
        <ul className="map-keys">
          {legend.keys.map((key) => (
            <li key={key.bin}>
              <span className="map-swatch" data-bin={key.bin} aria-hidden />
              {key.label}
            </li>
          ))}
        </ul>
      )}
      {legend.note && (
        <p className="map-note" data-caveat={legend.caveat || undefined}>
          {legend.note}
        </p>
      )}
      {legend.source && (
        <p className="map-source">
          <a href={legend.source.href} rel="noopener noreferrer" target="_blank">
            <span className="map-source-short">Source: {legend.source.short}</span>
            <span className="map-source-long">Source: {legend.source.label}</span>
          </a>
        </p>
      )}
    </figure>
  );
}
