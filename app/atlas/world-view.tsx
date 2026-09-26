/**
 * The world view of /atlas: the globe on the canvas shaded by one resource,
 * the resource picker in the bar, the legend on the map, and the country —
 * or the way to find one — in the panel.
 */
import Link from 'next/link';

import { AtlasBar, AtlasPick } from '@/components/portal/AtlasBar';
import { AtlasSheet } from '@/components/portal/AtlasSheet';
import { CountryFinder } from '@/components/portal/CountryFinder';
import { MapLegend } from '@/components/portal/MapLegend';
import { WorldMap } from '@/components/portal/WorldMap';
import { WorldPanel } from '@/components/portal/WorldPanel';
import { RESOURCE_KINDS } from '@/config/substrata-resources';
import { countryDossier } from '@/lib/geo';
import type { ChoroplethMeasure } from '@/lib/resources/choropleth';
import { MAP_COUNTRIES, MAP_ISOS } from './countries';
import { mapLayer, quantified } from './map-layer';

const NAMES = new Map(MAP_COUNTRIES.map((c) => [c.iso, c.name]));

/** The globe in words: what shades it and who is in the top band. */
function globeSummary(title: string, bins: Record<string, number>): string {
  const top = Object.entries(bins)
    .filter(([, bin]) => bin === 5)
    .map(([iso]) => NAMES.get(iso) ?? iso.toUpperCase());
  if (Object.keys(bins).length === 0) return `${title}. No country is shaded.`;
  return top.length
    ? `${title}. In the top band: ${top.slice(0, 8).join(', ')}${top.length > 8 ? ` and ${top.length - 8} more` : ''}.`
    : `${title}.`;
}

export function WorldView({
  country,
  resource,
  measure,
  keep,
  worldHref,
}: {
  country?: string;
  resource?: string;
  measure: ChoroplethMeasure;
  keep: Record<string, string>;
  worldHref: string;
}) {
  const selected = country?.toLowerCase() ?? '';
  const dossier = selected ? countryDossier(selected) : null;
  const layer = mapLayer(resource, measure, MAP_ISOS);
  const withData = quantified();
  const kind = RESOURCE_KINDS.find((r) => r.id === resource);
  const summary = globeSummary(layer.legend.title, layer.bins);
  const measureHref = (m: string) => {
    const params = new URLSearchParams({ view: 'world', ...keep });
    if (m === 'reserves') params.set('measure', m);
    else params.delete('measure');
    if (dossier) params.set('country', selected);
    return `/atlas?${params.toString()}`;
  };
  return (
    <>
      <div className="atlas-canvas">
        <WorldMap
          selected={dossier ? selected : undefined}
          keep={keep}
          bins={layer.bins}
          labels={layer.labels}
          otherwise={layer.otherwise}
          summary={summary}
        />
      </div>
      <AtlasBar view="world" worldHref={worldHref}>
        <AtlasPick
          label="Shade the globe by"
          name="resource"
          value={resource ?? ''}
          hidden={{ view: 'world', measure: keep.measure, country: dossier ? selected : undefined }}
        >
          <option value="">Pick a resource</option>
          <optgroup label="Production and reserves (USGS)">
            {RESOURCE_KINDS.filter((r) => withData.has(r.id)).map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Where it occurs (no country figures)">
            {RESOURCE_KINDS.filter((r) => !withData.has(r.id)).map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </optgroup>
        </AtlasPick>
      </AtlasBar>
      {/* Nothing picked, nothing shaded: the picker and the panel say how. */}
      {kind && <MapLegend legend={layer.legend} measureHref={measureHref} />}
      <AtlasSheet
        label={dossier ? `About ${dossier.name}` : 'Countries'}
        openKey={dossier ? selected : undefined}
        head={
          dossier ? (
            <div className="atlas-head-row">
              <div>
                <p className="atlas-kicker">
                  {dossier.region} · {dossier.iso2.toUpperCase()}
                </p>
                <p className="atlas-title">{dossier.name}</p>
                {kind && (
                  <p className="atlas-metric">
                    <span>{kind.label}</span> {layer.labels[selected] ?? layer.otherwise ?? '—'}
                  </p>
                )}
              </div>
              <Link className="atlas-close" href={worldHref} aria-label="Close this country">
                ×
              </Link>
            </div>
          ) : (
            <CountryFinder countries={MAP_COUNTRIES} keep={keep} />
          )
        }
      >
        <WorldPanel country={dossier ? selected : undefined} resource={resource} />
        {dossier && (
          <section className="atlas-section">
            <h3>Another country</h3>
            <CountryFinder countries={MAP_COUNTRIES} keep={keep} />
          </section>
        )}
      </AtlasSheet>
    </>
  );
}
