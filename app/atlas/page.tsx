/**
 * /atlas — where the constraints physically are.
 *
 * What it is FOR: a reader arrives with a thing (a bottleneck, a country, a
 * technology) and wants to see it in place. Three jobs, and nothing else:
 *
 *   1. See where a bottleneck sits and who makes it — the chains view: what
 *      it needs, the thing, its makers, what it holds up; walk upstream and
 *      downstream by clicking.
 *   2. See what a country holds and what constrains it — the world view:
 *      the map painted by one resource, the country's panel.
 *   3. See what a technology depends on — the chains view narrowed by
 *      ?topic=, reached from any technology node.
 *
 * One full-bleed canvas (the diagram or the map), one floating bar (the view
 * and its one choice), one panel (right from 1024px, a bottom sheet below).
 * The index of every bottleneck and the per-stage coverage counts are not
 * here: they live on /bottlenecks, which is that list, grouped by stage.
 *
 * URLs kept from before: ?view=world, ?country=, ?resource=, ?topic=, ?chain=.
 */
import type { Metadata } from 'next';
import Link from 'next/link';

import { Shell } from '@/components/portal/Shell';
import { AtlasBar, AtlasPick } from '@/components/portal/AtlasBar';
import { AtlasChain, ChainDetail, ChainHead } from '@/components/portal/AtlasChain';
import { AtlasSheet } from '@/components/portal/AtlasSheet';
import { CountryFinder } from '@/components/portal/CountryFinder';
import { MapLegend } from '@/components/portal/MapLegend';
import { WorldMap } from '@/components/portal/WorldMap';
import { WorldPanel } from '@/components/portal/WorldPanel';
import { RESOURCE_KINDS } from '@/config/substrata-resources';
import { STAGES } from '@/config/substrata-stages';
import { TECHNOLOGIES } from '@/config/substrata-taxonomy';
import { countryDossier } from '@/lib/geo';
import { chainFlow, pickable, resolveChain } from './chain-data';
import { MAP_COUNTRIES, MAP_ISOS } from './countries';
import { mapLayer } from './map-layer';

export const metadata: Metadata = {
  title: 'Map',
  description:
    'Where each bottleneck sits and who makes it, and what every country holds — one bottleneck or one resource at a time.',
};

type Params = {
  topic?: string;
  chain?: string;
  view?: string;
  country?: string;
  resource?: string;
};

export default async function AtlasPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const view = params.view === 'world' ? 'world' : 'chain';
  const resource = RESOURCE_KINDS.find((r) => r.id === params.resource)?.id;
  const worldHref = resource ? `/atlas?view=world&resource=${resource}` : '/atlas?view=world';
  return (
    <Shell>
      <div className="atlas" data-view={view}>
        <h1 className="sr-only">Map</h1>
        {view === 'world' ? (
          <WorldView country={params.country} resource={resource} worldHref={worldHref} />
        ) : (
          <ChainView topic={params.topic} requested={params.chain} worldHref={worldHref} />
        )}
      </div>
    </Shell>
  );
}

function ChainView({
  topic: requested,
  requested: chainSlug,
  worldHref,
}: {
  topic?: string;
  requested?: string;
  worldHref: string;
}) {
  const topic = TECHNOLOGIES.find((t) => t.id === requested)?.id ?? '';
  const chain = resolveChain(topic, chainSlug);
  const flow = chainFlow(chain, topic);
  const listed = pickable(topic);
  return (
    <>
      <div className="atlas-canvas atlas-canvas-chain">
        <AtlasChain chain={chain} flow={flow} />
      </div>
      <AtlasBar view="chain" worldHref={worldHref}>
        <AtlasPick label="Bottleneck" name="chain" value={chain.slug} hidden={{ topic }}>
          {STAGES.map((stage) => {
            const rows = listed.filter((b) => b.stage === stage.id);
            return rows.length === 0 ? null : (
              <optgroup key={stage.id} label={stage.name}>
                {rows.map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.name}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </AtlasPick>
        {topic && (
          <Link className="atlas-filter" href={`/atlas?chain=${chain.slug}`}>
            {TECHNOLOGIES.find((t) => t.id === topic)?.name}
            <span aria-hidden>×</span>
            <span className="sr-only">(remove this technology filter)</span>
          </Link>
        )}
      </AtlasBar>
      <AtlasSheet label={`About ${chain.name}`} head={<ChainHead chain={chain} />}>
        <ChainDetail chain={chain} flow={flow} />
      </AtlasSheet>
    </>
  );
}

function WorldView({
  country,
  resource,
  worldHref,
}: {
  country?: string;
  resource?: string;
  worldHref: string;
}) {
  const selected = country?.toLowerCase() ?? '';
  const dossier = selected ? countryDossier(selected) : null;
  const layer = mapLayer(resource, MAP_ISOS);
  return (
    <>
      <div className="atlas-canvas">
        <WorldMap
          selected={dossier ? selected : undefined}
          resource={resource}
          bins={layer.bins}
          labels={layer.labels}
        />
      </div>
      <AtlasBar view="world" worldHref={worldHref}>
        <AtlasPick
          label="Paint the map by"
          name="resource"
          value={resource ?? ''}
          hidden={{ view: 'world', country: dossier ? selected : undefined }}
        >
          <option value="">What is on record</option>
          {RESOURCE_KINDS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </AtlasPick>
      </AtlasBar>
      <MapLegend legend={layer.legend} />
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
              </div>
              <Link className="atlas-close" href={worldHref} aria-label="Close this country">
                ×
              </Link>
            </div>
          ) : (
            <CountryFinder countries={MAP_COUNTRIES} resource={resource} />
          )
        }
      >
        <WorldPanel country={dossier ? selected : undefined} />
        {dossier && (
          <section className="atlas-section">
            <h3>Another country</h3>
            <CountryFinder countries={MAP_COUNTRIES} resource={resource} />
          </section>
        )}
      </AtlasSheet>
    </>
  );
}
