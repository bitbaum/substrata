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
import { chainActions } from './chain-actions';
import { chainRoute } from './chain-route';
import { chainLenses, isLens, type LensId } from './lenses';

export function ChainView({
  topic: requested,
  requested: chainSlug,
  maker: makerSlug,
  lens: lensParam,
  worldHref,
}: {
  topic?: string;
  requested?: string;
  maker?: string;
  /** The lens the panel opens on (`?lens=`); the overview when absent or unknown. */
  lens?: string;
  worldHref: string;
}) {
  const topic = TECHNOLOGIES.find((t) => t.id === requested)?.id ?? '';
  const chain = resolveChain(topic, chainSlug);
  const flow = chainFlow(chain, topic);
  const story = chainStory(chain, flow, neighbors('bottleneck', chain.slug));
  const maker = makerDetail(chain, makerSlug);
  const listed = pickable(topic);
  const lens: LensId = isLens(lensParam) ? lensParam : 'overview';
  const lenses = chainLenses(chain, story);
  const hrefFor = (id: LensId) => chainHref(chain.slug, topic || undefined, undefined, id);
  return (
    <>
      <div className="atlas-canvas atlas-canvas-chain">
        <AtlasChain
          chain={chain}
          flow={flow}
          route={chainRoute(chain)}
          topic={topic}
          maker={maker?.slug}
          lens={lens}
        />
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
        <AtlasSheet
          label={`About ${chain.name}`}
          head={<ChainHead chain={chain} story={story} />}
          // A link that names a reading opens the panel on it, on a phone too.
          openKey={lens === 'overview' ? undefined : `lens:${lens}`}
        >
          <ChainDetail
            chain={chain}
            flow={flow}
            lenses={lenses}
            current={lens}
            hrefFor={hrefFor}
            actions={chainActions(chain)}
          />
        </AtlasSheet>
      )}
    </>
  );
}
