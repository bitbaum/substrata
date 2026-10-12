/**
 * The chains view of /atlas: the flow diagram on the canvas, the bottleneck
 * picker in the bar, and in the panel either what the chain tells us or — when
 * `?maker=` names one of its makers — that maker, in place.
 */
import Link from 'next/link';

import { AtlasBar, AtlasPick } from '@/components/portal/AtlasBar';
import { AtlasChain } from '@/components/portal/AtlasChain';
import {
  ChainDetail,
  ChainHead,
  MakerDetailPanel,
  MakerHead,
} from '@/components/portal/AtlasChainPanel';
import { AtlasSheet } from '@/components/portal/AtlasSheet';
import { STAGES } from '@/config/substrata-stages';
import { TECHNOLOGIES } from '@/config/substrata-taxonomy';
import { neighbors } from '@/lib/graph';
import { chainFlow, chainHref, makerDetail, pickable, resolveChain } from './chain-data';
import { chainStory } from './chain-story';

export function ChainView({
  topic: requested,
  requested: chainSlug,
  maker: makerSlug,
  worldHref,
}: {
  topic?: string;
  requested?: string;
  maker?: string;
  worldHref: string;
}) {
  const topic = TECHNOLOGIES.find((t) => t.id === requested)?.id ?? '';
  const chain = resolveChain(topic, chainSlug);
  const flow = chainFlow(chain, topic);
  const story = chainStory(chain, flow, neighbors('bottleneck', chain.slug));
  const maker = makerDetail(chain, makerSlug);
  const listed = pickable(topic);
  return (
    <>
      <div className="atlas-canvas atlas-canvas-chain">
        <AtlasChain chain={chain} flow={flow} maker={maker?.slug} />
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
      {maker ? (
        <AtlasSheet
          label={`About ${maker.name}`}
          head={<MakerHead maker={maker} chain={chain} />}
          openKey={`maker:${maker.slug}`}
        >
          <MakerDetailPanel maker={maker} chain={chain} backHref={chainHref(chain.slug, topic)} />
        </AtlasSheet>
      ) : (
        <AtlasSheet label={`About ${chain.name}`} head={<ChainHead chain={chain} story={story} />}>
          <ChainDetail chain={chain} flow={flow} story={story} />
        </AtlasSheet>
      )}
    </>
  );
}
