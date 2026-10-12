/**
 * The chains view: one bottleneck as a diagram — what it needs on the left,
 * the thing in the middle with its makers feeding down into it, what it
 * holds up on the right — and the panel that says, in plain words, what the
 * chain is telling us. On a phone the diagram runs top to bottom in the same
 * reading order: needs, makers, the thing, what it holds up.
 *
 * Every node stays on the map. An upstream or downstream bottleneck
 * re-centres the diagram on itself; a maker opens in the panel beside it, so
 * walking a chain never means leaving it and pressing Back.
 */
import Link from 'next/link';

import { Figure } from './Figure';
import { ChainLinks } from './ChainLinks';
import { STAGE_LABEL } from '@/config/substrata-stages';
import { HORIZON_LABEL } from '@/config/substrata-assessment';
import type { Bottleneck } from '@/lib/bottlenecks';
import type { ChainFlow, FlowNode } from '@/app/atlas/chain-data';

type Lane = 'needs' | 'makers' | 'feeds';

function Node({ node, lane, current }: { node: FlowNode; lane: Lane; current?: boolean }) {
  return (
    <li data-flow-node data-lane={lane} data-key={`${lane}:${node.makerSlug ?? node.href}`}>
      <Link
        href={node.href}
        scroll={false}
        className="flow-card"
        aria-current={current ? 'true' : undefined}
        data-supplier={node.supplier || undefined}
      >
        {node.role && <span className="flow-role">{node.role}</span>}
        <span className="flow-label">{node.label}</span>
        {node.note && <span className="flow-note">{node.note}</span>}
      </Link>
    </li>
  );
}

function Lane({
  index,
  title,
  lane,
  nodes,
  empty,
  current,
  className,
  children,
}: {
  index: string;
  title: string;
  lane: Lane;
  nodes: FlowNode[];
  empty: string;
  current?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className={`flow-col ${className ?? ''}`} aria-labelledby={`flow-${lane}`}>
      <h2 id={`flow-${lane}`} className="flow-kicker">
        <span>{index}</span> {title}
      </h2>
      {nodes.length > 0 ? (
        <ul className="flow-nodes">
          {nodes.map((n) => (
            <Node
              key={n.href + n.label}
              node={n}
              lane={lane}
              current={current !== undefined && current !== '' && n.makerSlug === current}
            />
          ))}
        </ul>
      ) : (
        <p className="flow-empty">{empty}</p>
      )}
      {children}
    </section>
  );
}

function Arrow({ label }: { label: string }) {
  return (
    <div className="flow-arrow" aria-hidden>
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M4 12h15m-5-5 5 5-5 5" />
      </svg>
      <span>{label}</span>
    </div>
  );
}

/** Twelve ticks, the lit ones being the score: the severity you can see. */
function SeverityMeter({ score }: { score: number }) {
  return (
    <span className="flow-meter" aria-hidden>
      {Array.from({ length: 12 }, (_, i) => (
        <i key={i} data-lit={i < score || undefined} />
      ))}
    </span>
  );
}

export function AtlasChain({
  chain,
  flow,
  maker,
}: {
  chain: Bottleneck;
  flow: ChainFlow;
  /** The maker `?maker=` selected, lit on the diagram. */
  maker?: string;
}) {
  return (
    <div className="flow" aria-label={`Supply chain of ${chain.name}`} role="group">
      <ChainLinks />
      <Lane
        index="01"
        title="Needs"
        lane="needs"
        nodes={flow.needs}
        empty="No upstream bottleneck on record."
        className="flow-needs"
      />
      <Arrow label="goes into" />
      <Lane
        index="02"
        title="Made by"
        lane="makers"
        nodes={flow.makers}
        empty="No maker on record yet — a research gap."
        current={maker ?? ''}
        className="flow-makers"
      />
      <Arrow label="builds" />
      <section className="flow-col flow-focus" aria-labelledby="flow-focus" data-flow-focus>
        <p className="flow-kicker">
          <span>03</span> {STAGE_LABEL[chain.stage]}
        </p>
        <h2 id="flow-focus" className="flow-title">
          {chain.name}
        </h2>
        <SeverityMeter score={chain.binding} />
        <p className="flow-note">
          severity <Figure method="severity">{chain.binding}/12</Figure> ·{' '}
          {HORIZON_LABEL[chain.horizon]}
        </p>
      </section>
      <Arrow label="holds up" />
      <Lane
        index="04"
        title="Holds up"
        lane="feeds"
        nodes={flow.feeds}
        empty="Nothing downstream on record yet."
        className="flow-feeds"
      >
        {flow.technologies.length > 0 && (
          <div className="flow-fields">
            <p className="flow-kicker">
              <span>+</span> Fields it serves
            </p>
            <ul className="flow-chips">
              {flow.technologies.map((t) => (
                <li key={t.href}>
                  <Link href={t.href} scroll={false}>
                    {t.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Lane>
    </div>
  );
}
