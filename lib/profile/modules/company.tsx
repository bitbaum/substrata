import Link from 'next/link';

import { EventList } from '@/components/portal/EventList';
import { Empty } from '@/components/portal/Shell';
import { Status } from '@/components/portal/Status';
import { INDUSTRY_LABEL, TECHNOLOGY_LABEL } from '@/config/substrata-taxonomy';
import { SCIENCE } from '@/config/substrata-science';
import { participantBySlug, type MarketParticipant } from '../../participants';
import { bottleneckHref, scienceHref } from '../../links';
import type { Entity } from '../../entities/types';
import type { ProfileModule } from '../types';

/**
 * These were four hand-written sections on the company page. As modules they
 * are ordered by the registry rather than by their position in a file, they
 * disappear when they have nothing to say instead of rendering an empty shell,
 * and widening one to another kind is a change to `appliesTo` rather than a
 * copy into a second page.
 */
function participant(entity: Entity): MarketParticipant | undefined {
  return entity.kind === 'company' ? participantBySlug(entity.key) : undefined;
}

const products: ProfileModule<MarketParticipant> = {
  id: 'products',
  title: 'What it makes',
  appliesTo: ['company'],
  importance: 10,
  load: participant,
  evidence: (p) => (p.produces.length > 0 ? `${p.produces.length} mapped` : undefined),
  Render({ data: p }) {
    if (p.produces.length === 0)
      return (
        <Empty
          what="No covered material is mapped to this organisation yet."
          next="It appears here as context for the chain it sits in."
        />
      );
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-strong">
              {['Material', 'Step', 'Evidence'].map((c) => (
                <th
                  key={c}
                  scope="col"
                  className="py-2.5 pr-4 font-mono text-xs font-medium uppercase tracking-caps text-fg-tertiary"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {p.produces.map((item) => (
              <tr key={item.bottleneck} className="align-top">
                <td className="py-3 pr-4">
                  <Link
                    href={bottleneckHref(item.slug)}
                    className="text-fg-primary underline-offset-4 hover:underline"
                  >
                    {item.bottleneck}
                  </Link>
                </td>
                <td className="py-3 pr-4 text-sm text-fg-secondary">{item.step}</td>
                <td className="py-3 text-sm">
                  {item.source ? (
                    <a
                      href={item.source}
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-accent underline-offset-4 hover:underline"
                    >
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 rounded-full bg-status-positive"
                      />
                      Verified source ↗
                    </a>
                  ) : (
                    <Status
                      state={item.verification}
                      label={
                        item.candidateCount > 0
                          ? `${item.candidateCount} source${item.candidateCount > 1 ? 's' : ''} found, unchecked`
                          : undefined
                      }
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  },
};

const topics: ProfileModule<MarketParticipant> = {
  id: 'topics',
  title: 'Where this matters',
  appliesTo: ['company'],
  importance: 20,
  load(entity) {
    const p = participant(entity);
    if (!p) return null;
    return p.technologies.length > 0 || p.industries.length > 0 ? p : null;
  },
  Render({ data: p }) {
    return (
      <div className="flex flex-wrap gap-2">
        {p.technologies.map((t) => (
          <Link
            key={t}
            href={`/bottlenecks?tech=${t}`}
            className="inline-flex min-h-9 items-center rounded-full border border-strong px-3 text-sm text-fg-secondary hover:border-accent hover:text-fg-primary"
          >
            {TECHNOLOGY_LABEL[t]}
          </Link>
        ))}
        {p.industries.map((i) => (
          <Link
            key={i}
            href={`/markets?industry=${i}`}
            className="inline-flex min-h-9 items-center rounded-full border border-strong px-3 text-sm text-fg-secondary hover:border-accent hover:text-fg-primary"
          >
            {INDUSTRY_LABEL[i]}
          </Link>
        ))}
      </div>
    );
  },
};

/** Science mapped to the materials this organisation makes — not to the organisation. */
const relief: ProfileModule<typeof SCIENCE> = {
  id: 'relief',
  title: 'What could change its position',
  appliesTo: ['company'],
  importance: 30,
  load(entity) {
    const p = participant(entity);
    if (!p) return null;
    const entries = SCIENCE.filter((s) =>
      s.relieves.some((r) => p.produces.some((x) => x.bottleneck === r.bottleneck)),
    );
    // Rendered even when empty on the old page; keep saying so rather than
    // vanishing, because "nothing would relieve this" is itself informative.
    return entries;
  },
  Render({ data }) {
    return (
      <>
        <p className="mb-4 max-w-prose text-sm text-fg-secondary">
          These research approaches address materials mapped to this organisation. This does not
          establish a partnership, investment or adoption by the company.
        </p>
        {data.length === 0 ? (
          <p className="text-sm text-fg-secondary">No relevant science entries are mapped yet.</p>
        ) : (
          <div className="research-card-grid">
            {data.map((s) => (
              <article key={s.id}>
                <h2>
                  <Link href={scienceHref(s.id)}>{s.name}</Link>
                </h2>
                <p>{s.plain}</p>
                <p>
                  Readiness {s.readiness}/9 · analyst judgement · {s.judgedOn}
                </p>
                <Link href={scienceHref(s.id)}>Mechanism and evidence →</Link>
              </article>
            ))}
          </div>
        )}
      </>
    );
  },
};

/**
 * What the profile does NOT establish.
 *
 * Saying this out loud is the same discipline as marking a row unverified: a
 * reader should not have to infer that revenue and contracts are absent because
 * nobody checked rather than because they do not matter.
 */
const gaps: ProfileModule<MarketParticipant> = {
  id: 'gaps',
  title: 'Questions the profile does not yet answer',
  appliesTo: ['company'],
  importance: 35,
  load: participant,
  Render({ data: p }) {
    return (
      <div className="research-prose">
        <p>
          Revenue, production capacity, customer contracts, hiring needs and private supplier
          relationships are not established by this directory. Help document them with dated, public
          sources.
        </p>
        <Link href={`/chat?topic=${encodeURIComponent(p.name)}`}>
          Ask Substrata about {p.name}, or contribute expertise →
        </Link>
      </div>
    );
  },
};

const timeline: ProfileModule<MarketParticipant> = {
  id: 'timeline',
  title: 'Timeline',
  appliesTo: ['company'],
  importance: 40,
  load: participant,
  Render({ data: p }) {
    if (p.events.length === 0)
      return (
        <Empty
          what="Nothing recorded about this organisation yet."
          next="Events are added when a source is read and accepted."
        />
      );
    return <EventList events={p.events} />;
  },
};

export { products, topics, relief, gaps, timeline };
