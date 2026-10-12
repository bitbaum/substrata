/**
 * What the colour on the globe means: the picker for what shades it, the
 * measure and year in the title,
 * the scale's steps, the categorical keys (hatched, not listed), the unit or
 * caveat, and the source — edition and table — it came from.
 */
import type { MapLegend as Legend } from '@/app/atlas/map-layer';
import { UNSOURCED_SHADINGS } from '@/app/atlas/map-shading';
import { AtlasPick } from './AtlasBar';

export function MapLegend({
  legend,
  measureHidden,
  sites = 0,
}: {
  legend: Legend;
  /** What the shading picker carries besides ?measure=: the rest of the URL. */
  measureHidden?: Record<string, string | undefined>;
  /** Producer sites drawn for this resource; their key, when there are any. */
  sites?: number;
}) {
  return (
    <figure className="map-legend">
      <figcaption>{legend.title}</figcaption>
      {legend.measures && measureHidden && (
        <AtlasPick
          label="Shade the globe by"
          name="measure"
          value={legend.measures.find((m) => m.current)?.id ?? ''}
          hidden={measureHidden}
        >
          {legend.measures.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
          {UNSOURCED_SHADINGS.map((label) => (
            <option key={label} disabled>
              {label} — no source on file yet
            </option>
          ))}
        </AtlasPick>
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
      {sites > 0 && (
        <ul className="map-keys map-sites">
          <li>
            <span className="map-site" aria-hidden />
            {sites} producer sites (USGS), at the facility or its town
          </li>
          <li>
            <span className="map-site" data-region aria-hidden />
            Province only
          </li>
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
