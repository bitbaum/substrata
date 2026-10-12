/**
 * The atlas panel for the chains view: what the chain tells us in plain
 * words (ChainHead + ChainDetail), or — when a maker is selected — that
 * maker, in place (MakerHead + MakerDetailPanel). The diagram itself is
 * AtlasChain.tsx; this is the reading beside it.
 */
import Link from 'next/link';

import { STAGE_LABEL } from '@/config/substrata-stages';
import { bottleneckHref } from '@/lib/links';
import type { Bottleneck } from '@/lib/bottlenecks';
import type { ChainFlow, MakerDetail } from '@/app/atlas/chain-data';
import type { ChainStory } from '@/app/atlas/chain-story';
import type { ChainAction } from '@/app/atlas/chain-actions';
import { LensBody, LensTabs } from './ChainLenses';
import type { Lens, LensId } from '@/app/atlas/lenses';

/** The panel for a chain: its head (always visible) and what it is. */
export function ChainHead({ chain, story }: { chain: Bottleneck; story: ChainStory }) {
  return (
    <>
      <p className="atlas-kicker">
        {STAGE_LABEL[chain.stage]} · {chain.state}
      </p>
      <p className="atlas-title">{chain.name}</p>
      <p className="atlas-lede flow-story-lede">{story.lede}</p>
    </>
  );
}

export function ChainDetail({
  chain,
  flow,
  lenses,
  current,
  hrefFor,
  actions,
}: {
  chain: Bottleneck;
  flow: ChainFlow;
  /** The chain read six ways, and the one open. */
  lenses: Lens[];
  current: LensId;
  hrefFor: (id: LensId) => string;
  /** What a reader can do with this chain, by who they are. */
  actions: ChainAction[];
}) {
  const lens = lenses.find((l) => l.id === current) ?? lenses[0];
  return (
    <>
      <LensTabs lenses={lenses} current={lens.id} hrefFor={hrefFor} />
      <LensBody lens={lens} actions={actions} />
      {lens.id === 'overview' && flow.places.length > 0 && (
        <section className="atlas-section">
          <h3>Where it sits</h3>
          <ul className="atlas-chips">
            {flow.places.map((p) => (
              <li key={p.iso2}>
                <Link href={p.href}>{p.name}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="atlas-actions">
        <Link href={bottleneckHref(chain.slug)} className="atlas-primary">
          Full evidence
        </Link>
        <Link href={`/atlas?view=world&chain=${chain.slug}`} className="atlas-secondary">
          On the globe
        </Link>
      </div>
      <p className="atlas-fine">
        Built from the records on file, not written by hand: a figure or a name here is a row with a
        source, and a gap says it is a gap. Severity, readiness and the skills a bottleneck needs
        are analyst judgements, dated.
      </p>
    </>
  );
}

/** The panel when a maker is selected: who they are on this chain, in place. */
export function MakerHead({ maker, chain }: { maker: MakerDetail; chain: Bottleneck }) {
  return (
    <>
      <p className="atlas-kicker">
        {maker.role} · {chain.name}
      </p>
      <p className="atlas-title">{maker.name}</p>
      <p className="atlas-lede">
        {maker.countries.length > 0 ? `${maker.countries.join(' · ')} · ` : ''}
        {maker.verificationLabel}
      </p>
    </>
  );
}

export function MakerDetailPanel({
  maker,
  chain,
  backHref,
}: {
  maker: MakerDetail;
  chain: Bottleneck;
  backHref: string;
}) {
  return (
    <>
      <section className="atlas-section flow-story">
        <div className="flow-story-part">
          <h3>On this chain</h3>
          <p>
            {maker.supplier
              ? `${maker.name} supplies a part ${chain.name} cannot ship without.`
              : `${maker.name} builds ${chain.name}.`}
            {maker.directory?.role ? ` In the directory: ${maker.directory.role}.` : ''}
          </p>
        </div>
        {maker.directory?.why && (
          <div className="flow-story-part">
            <h3>Why it matters</h3>
            <p>{maker.directory.why}</p>
          </div>
        )}
        {(maker.directory?.scarcity || maker.directory?.layer) && (
          <dl className="atlas-facts">
            {maker.directory.scarcity && (
              <div>
                <dt>Scarcity</dt>
                <dd>{maker.directory.scarcity}</dd>
              </div>
            )}
            {maker.directory.layer && (
              <div>
                <dt>Layer</dt>
                <dd>{maker.directory.layer}</dd>
              </div>
            )}
            <div>
              <dt>Evidence</dt>
              <dd>{maker.verificationLabel}</dd>
            </div>
          </dl>
        )}
        {maker.source && (
          <p className="atlas-fine">
            Source:{' '}
            <a href={maker.source} target="_blank" rel="noreferrer">
              {new URL(maker.source).hostname.replace(/^www\./, '')}
            </a>
          </p>
        )}
      </section>
      <div className="atlas-actions">
        <Link href={backHref} className="atlas-secondary" scroll={false}>
          ← Back to the chain
        </Link>
        {maker.profileHref && (
          <Link href={maker.profileHref} className="atlas-primary">
            Full profile
          </Link>
        )}
      </div>
    </>
  );
}
