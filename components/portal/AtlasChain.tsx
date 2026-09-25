/**
 * The chains view: one bottleneck as a single left-to-right diagram —
 * what it needs, the thing itself, who makes it, what it holds up — and the
 * panel that says what it is and how hard it binds. On a phone the diagram
 * turns to run top to bottom; the order of reading does not change.
 *
 * Every node is a link: an upstream or downstream bottleneck re-centres the
 * diagram on itself, so a reader can walk a whole supply chain here.
 */
import Link from 'next/link';

import { Figure } from './Figure';
import { STAGE_LABEL } from '@/config/substrata-stages';
import { HORIZON_LABEL } from '@/config/substrata-assessment';
import { bottleneckHref } from '@/lib/links';
import type { Bottleneck } from '@/lib/bottlenecks';
import type { ChainFlow, FlowNode } from '@/app/atlas/chain-data';

function Column({
  index,
  title,
  nodes,
  empty,
  children,
}: {
  index: string;
  title: string;
  nodes?: FlowNode[];
  empty?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="flow-col" aria-labelledby={`flow-${index}`}>
      <h2 id={`flow-${index}`} className="flow-kicker">
        <span>{index}</span> {title}
      </h2>
      {children}
      {nodes && nodes.length > 0 && (
        <ul className="flow-nodes">
          {nodes.map((n) => (
            <li key={n.href + n.label}>
              <Link href={n.href} scroll={false}>
                <span className="flow-label">{n.label}</span>
                {n.note && <span className="flow-note">{n.note}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {nodes && nodes.length === 0 && empty && <p className="flow-empty">{empty}</p>}
    </section>
  );
}

function Arrow() {
  return (
    <div className="flow-arrow" aria-hidden>
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M4 12h15m-5-5 5 5-5 5" />
      </svg>
    </div>
  );
}

export function AtlasChain({ chain, flow }: { chain: Bottleneck; flow: ChainFlow }) {
  return (
    <div className="flow" aria-label={`Supply chain of ${chain.name}`} role="group">
      <Column
        index="01"
        title="Needs"
        nodes={flow.needs}
        empty="No upstream bottleneck on record."
      />
      <Arrow />
      <section className="flow-col flow-focus" aria-labelledby="flow-focus">
        <p className="flow-kicker">
          <span>02</span> {STAGE_LABEL[chain.stage]}
        </p>
        <h2 id="flow-focus" className="flow-title">
          {chain.name}
        </h2>
        <p className="flow-note">
          severity <Figure method="severity">{chain.binding}/12</Figure> ·{' '}
          {HORIZON_LABEL[chain.horizon]}
        </p>
      </section>
      <Arrow />
      <Column
        index="03"
        title="Made by"
        nodes={flow.makers}
        empty="No maker on record yet — a research gap."
      />
      <Arrow />
      <Column index="04" title="Holds up">
        <ul className="flow-nodes">
          {[...flow.feeds, ...flow.technologies].map((n) => (
            <li key={n.href}>
              <Link href={n.href} scroll={false}>
                <span className="flow-label">{n.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Column>
    </div>
  );
}

/** The panel for a chain: its head (always visible) and what it is. */
export function ChainHead({ chain }: { chain: Bottleneck }) {
  return (
    <>
      <p className="atlas-kicker">
        {STAGE_LABEL[chain.stage]} · {chain.state}
      </p>
      <p className="atlas-title">{chain.name}</p>
    </>
  );
}

export function ChainDetail({ chain, flow }: { chain: Bottleneck; flow: ChainFlow }) {
  return (
    <>
      <p className="atlas-lede">{chain.plain}</p>
      <dl className="atlas-facts">
        <div>
          <dt>Severity</dt>
          <dd>
            <Figure method="severity">{chain.binding}/12</Figure>
          </dd>
        </div>
        <div>
          <dt>When</dt>
          <dd>{HORIZON_LABEL[chain.horizon]}</dd>
        </div>
        <div>
          <dt>Judged</dt>
          <dd>{chain.judgedOn}</dd>
        </div>
      </dl>
      {flow.places.length > 0 && (
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
        <Link href="/bottlenecks" className="atlas-secondary">
          All bottlenecks
        </Link>
      </div>
      <p className="atlas-fine">
        Lines are coverage, not customer contracts: a sourced maker row means there is a document
        for that claim.
      </p>
    </>
  );
}
