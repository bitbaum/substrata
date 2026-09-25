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

import { Shell } from '@/components/portal/Shell';
import { RESOURCE_KINDS } from '@/config/substrata-resources';
import { ChainView } from './chain-view';
import { WorldView } from './world-view';

export const metadata: Metadata = {
  title: 'Map',
  description:
    'Where each bottleneck sits and who makes it, and what every country produces and holds — one bottleneck or one resource at a time.',
};

type Params = {
  topic?: string;
  chain?: string;
  view?: string;
  country?: string;
  resource?: string;
  measure?: string;
};

export default async function AtlasPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const view = params.view === 'world' ? 'world' : 'chain';
  const resource = RESOURCE_KINDS.find((r) => r.id === params.resource)?.id;
  const measure = params.measure === 'reserves' ? 'reserves' : 'production';
  // What the world view carries from one click to the next.
  const keep: Record<string, string> = {};
  if (resource) keep.resource = resource;
  if (resource && measure === 'reserves') keep.measure = measure;
  const worldHref = `/atlas?${new URLSearchParams({ view: 'world', ...keep }).toString()}`;
  return (
    <Shell>
      <div className="atlas" data-view={view}>
        <h1 className="sr-only">Map</h1>
        {view === 'world' ? (
          <WorldView
            country={params.country}
            resource={resource}
            measure={measure}
            keep={keep}
            worldHref={worldHref}
          />
        ) : (
          <ChainView topic={params.topic} requested={params.chain} worldHref={worldHref} />
        )}
      </div>
    </Shell>
  );
}
