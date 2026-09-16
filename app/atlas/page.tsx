import Link from 'next/link';
import { Page, Shell, SectionHeader } from '@/components/portal/Shell';
import { WorldPanel } from '@/components/portal/WorldPanel';
import { AtlasChain } from '@/components/portal/AtlasChain';
import { TECHNOLOGIES } from '@/config/substrata-taxonomy';
import { BOTTLENECKS } from '@/lib/bottlenecks';

export const metadata = {
  title: 'Map',
  description: 'Trace one bottleneck from producers to technologies, or open any country.',
};

export default async function AtlasPage({
  searchParams,
}: {
  searchParams: Promise<{
    topic?: string;
    chain?: string;
    view?: string;
    country?: string;
    resource?: string;
  }>;
}) {
  const {
    topic: requested,
    chain: requestedChain,
    view: requestedView,
    country,
    resource,
  } = await searchParams;
  const view = requestedView === 'world' ? 'world' : 'chain';
  const topic = TECHNOLOGIES.find((t) => t.id === requested)?.id ?? '';
  const listed = topic ? BOTTLENECKS.filter((b) => b.technologies.includes(topic)) : BOTTLENECKS;
  const chain =
    listed.find((b) => b.slug === requestedChain) ??
    listed.find((b) => b.producers.length > 0) ??
    listed[0] ??
    BOTTLENECKS[0];
  return (
    <Shell currentPath="atlas">
      <Page>
        <SectionHeader
          title="The map"
          lede="Pick a bottleneck and see who the corpus records as making it, and which technologies it gates. Or open the world and click a country."
        />
        <nav className="map-views" aria-label="Map view">
          <Link href="/atlas" aria-current={view === 'chain' ? 'page' : undefined}>
            Chains
          </Link>
          <Link href="/atlas?view=world" aria-current={view === 'world' ? 'page' : undefined}>
            World
          </Link>
        </nav>
        {view === 'world' ? (
          <WorldPanel country={country} resource={resource} />
        ) : (
          <AtlasChain topic={topic} chain={chain} />
        )}
      </Page>
    </Shell>
  );
}
