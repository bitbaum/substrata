/**
 * The chains view of /atlas: the flow diagram on the canvas, the bottleneck
 * picker in the bar, the bottleneck's detail in the panel.
 */
import Link from 'next/link';

import { AtlasBar, AtlasPick } from '@/components/portal/AtlasBar';
import { AtlasChain, ChainDetail, ChainHead } from '@/components/portal/AtlasChain';
import { AtlasSheet } from '@/components/portal/AtlasSheet';
import { STAGES } from '@/config/substrata-stages';
import { TECHNOLOGIES } from '@/config/substrata-taxonomy';
import { chainFlow, pickable, resolveChain } from './chain-data';

export function ChainView({
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
