/**
 * The chains view: one bottleneck as a route — every step that goes into it
 * and everything it holds up, two levels each way, in the order material
 * moves, left to right (top to bottom on a phone). Each step says where it is
 * made; the bottleneck's own card says who makes it, so a maker sits inside
 * the thing it builds rather than on a line of its own.
 *
 * The same route is laid over the Earth one link away (/atlas?view=world&
 * chain=), numbered the same, so the diagram and the globe are two readings
 * of one record. Every node stays on the map: a step re-centres the route on
 * itself; a maker opens in the panel beside it.
 */
import Link from 'next/link';

import { Figure } from './Figure';
import { ChainLinks } from './ChainLinks';
import { STAGE_LABEL } from '@/config/substrata-stages';
import { HORIZON_LABEL } from '@/config/substrata-assessment';
import type { Bottleneck } from '@/lib/bottlenecks';
import type { ChainFlow, FlowNode } from '@/app/atlas/chain-data';
import { chainHref } from '@/app/atlas/chain-data';
import type { ChainRoute, RouteStep } from '@/app/atlas/chain-route';

const COLUMN: Record<number, string> = {
  [-2]: 'Further upstream',
  [-1]: 'Goes into it',
  1: 'Holds up',
  2: 'And then',
};

/** "NL" or "CN PE ID +4": where a step is made, at a glance. */
function codes(isos: string[], max = 4): string {
  if (isos.length === 0) return 'no country on record';
  const shown = isos.slice(0, max).map((c) => c.toUpperCase());
  return isos.length > max ? `${shown.join(' ')} +${isos.length - max}` : shown.join(' ');
}

const pad = (n: number) => String(n).padStart(2, '0');

function Step({ step, topic }: { step: RouteStep; topic: string }) {
  return (
    <li data-flow-node data-key={step.slug}>
      <Link href={chainHref(step.slug, topic || undefined)} scroll={false} className="flow-card">
        <span className="flow-role">
          {pad(step.step)} · {codes(step.isos)}
        </span>
        <span className="flow-label">{step.name}</span>
        <span className="flow-note">
          severity {step.binding}/12
          {step.beyond > 0 && ` · goes on (${step.beyond})`}
        </span>
      </Link>
    </li>
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

function Makers({ title, nodes, current }: { title: string; nodes: FlowNode[]; current?: string }) {
  if (nodes.length === 0) return null;
  return (
    <div className="flow-makers">
      <p className="flow-kicker">{title}</p>
      <ul>
        {nodes.map((n) => (
          <li key={n.href}>
            <Link
              href={n.href}
              scroll={false}
              className="flow-maker"
              aria-current={n.makerSlug === current ? 'true' : undefined}
            >
              <span>{n.label}</span>
              <span className="flow-note">{n.note}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Focus({
  chain,
  step,
  flow,
  maker,
}: {
  chain: Bottleneck;
  step: RouteStep;
  flow: ChainFlow;
  maker?: string;
}) {
  const makers = flow.makers.filter((m) => !m.supplier);
  const parts = flow.makers.filter((m) => m.supplier);
  return (
    <div className="flow-focus" data-flow-node data-key={chain.slug} data-flow-focus>
      <p className="flow-kicker">
        <span>{pad(step.step)}</span> {STAGE_LABEL[chain.stage]}
      </p>
      <h2 id="flow-focus" className="flow-title">
        {chain.name}
      </h2>
      <SeverityMeter score={chain.binding} />
      <p className="flow-note">
        severity <Figure method="severity">{chain.binding}/12</Figure> ·{' '}
        {HORIZON_LABEL[chain.horizon]}
      </p>
      {makers.length === 0 && parts.length === 0 ? (
        <p className="flow-empty">No maker on record yet — a research gap.</p>
      ) : (
        <>
          <Makers title="Made by" nodes={makers} current={maker} />
          <Makers title="Critical parts from" nodes={parts} current={maker} />
        </>
      )}
      <Link className="flow-globe" href={`/atlas?view=world&chain=${chain.slug}`} scroll={false}>
        On the globe <span aria-hidden>→</span>
      </Link>
    </div>
  );
}

export function AtlasChain({
  chain,
  flow,
  route,
  topic = '',
  maker,
}: {
  chain: Bottleneck;
  flow: ChainFlow;
  route: ChainRoute;
  topic?: string;
  /** The maker `?maker=` selected, lit on the diagram. */
  maker?: string;
}) {
  const levels = [...new Set(route.steps.map((s) => s.level))].sort((a, b) => a - b);
  const self = route.steps.find((s) => s.level === 0)!;
  return (
    <div
      className="flow"
      aria-label={`Supply chain of ${chain.name}`}
      role="group"
      // One track per level; the bottleneck's own is wider, it carries its makers.
      style={{
        ['--flow-template' as string]: levels
          .map((lv) => (lv === 0 ? 'minmax(11rem, 1.3fr)' : 'minmax(6.75rem, 1fr)'))
          .join(' '),
      }}
    >
      <ChainLinks edges={route.edges} />
      {levels.map((lv, i) => (
        <section
          key={lv}
          className="flow-col"
          data-level={lv === 0 ? 'self' : lv < 0 ? 'up' : 'down'}
          aria-label={lv === 0 ? chain.name : COLUMN[lv]}
        >
          {i > 0 && (
            <div className="flow-arrow" aria-hidden>
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M4 12h15m-5-5 5 5-5 5" />
              </svg>
              <span>{lv <= 0 ? 'goes into' : 'holds up'}</span>
            </div>
          )}
          {lv === 0 ? (
            <Focus chain={chain} step={self} flow={flow} maker={maker} />
          ) : (
            <>
              <h2 className="flow-kicker">{COLUMN[lv]}</h2>
              <ul className="flow-nodes">
                {route.steps
                  .filter((s) => s.level === lv)
                  .map((s) => (
                    <Step key={s.slug} step={s} topic={topic} />
                  ))}
              </ul>
            </>
          )}
        </section>
      ))}
      {levels.length === 1 && (
        <p className="flow-empty flow-alone">
          Nothing upstream or downstream of it is on record yet.
        </p>
      )}
      {flow.technologies.length > 0 && (
        <div className="flow-fields">
          <p className="flow-kicker">Fields it serves</p>
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
    </div>
  );
}
