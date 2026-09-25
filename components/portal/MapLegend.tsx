/**
 * What the colour on the world map means: the measure and year in the title,
 * one swatch per step, the unit or caveat, and the source it came from.
 */
import type { MapLegend as Legend } from '@/app/atlas/map-layer';

export function MapLegend({ legend }: { legend: Legend }) {
  return (
    <figure className="map-legend" data-kind={legend.kind}>
      <figcaption>{legend.title}</figcaption>
      <ul>
        {legend.stops.map((stop) => (
          <li key={stop.bin}>
            <span className="map-swatch" data-bin={stop.bin} aria-hidden />
            {stop.label}
          </li>
        ))}
      </ul>
      {(legend.note || legend.source) && (
        <p>
          {legend.note}
          {legend.source && (
            <>
              {' '}
              <a href={legend.source.href} rel="noopener noreferrer" target="_blank">
                {legend.source.label}
              </a>
            </>
          )}
        </p>
      )}
    </figure>
  );
}
