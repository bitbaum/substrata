import Link from 'next/link';

import { participantBySlug } from '../../participants';
import { bottleneckBySlug } from '../../bottlenecks';
import { resolveIn, resolveEntity } from '../../entities/registry';
import { connectionsOf } from '../../relations/registry';
import { eventsNewestFirst } from '@/config/substrata-events';
import { t } from '../../i18n/messages';
import type { Entity } from '../../entities/types';
import type { ProfileModule } from '../types';

interface Peer {
  entity: Entity;
  /** The material both organisations are recorded as making. */
  shared: Entity;
  evidence: string;
}

/**
 * Who else makes the same thing.
 *
 * "One company on earth builds them" is the kind of claim this site exists to
 * substantiate, and a profile that does not show the other makers cannot be
 * checked — a reader has to take the concentration on trust. The relation layer
 * already knows: same bottleneck, other producers.
 *
 * It is coverage, never a market. The corpus lists who it has found, and says
 * so, because "the only producer" and "the only producer we have sourced" are
 * very different claims.
 */
const peers: ProfileModule<Peer[]> = {
  id: 'peers',
  title: t('profile.peers.title'),
  appliesTo: ['company'],
  importance: 15,
  load(entity: Entity) {
    if (entity.kind !== 'company') return null;
    const found: Peer[] = [];
    const seen = new Set<string>();
    for (const connection of connectionsOf(entity.id)) {
      if (connection.kind !== 'produces') continue;
      const material = resolveEntity(connection.other);
      if (!material) continue;
      for (const back of connectionsOf(material.id)) {
        if (back.kind !== 'produces' || back.other === entity.id) continue;
        const other = resolveEntity(back.other);
        if (!other || seen.has(other.id)) continue;
        seen.add(other.id);
        found.push({ entity: other, shared: material, evidence: back.evidence });
      }
    }
    return found.length > 0 ? found : null;
  },
  evidence: (found) => `${found.length} other recorded maker${found.length === 1 ? '' : 's'}`,
  Render({ data }) {
    return (
      <>
        <ul className="divide-y divide-subtle border-y border-subtle">
          {data.map((peer) => {
            const participant = participantBySlug(peer.entity.key);
            return (
              <li key={`${peer.entity.id}:${peer.shared.id}`} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <Link
                    href={peer.entity.href}
                    className="font-medium text-fg-primary underline-offset-4 hover:underline"
                  >
                    {peer.entity.name}
                  </Link>
                  <span className="font-mono text-xs uppercase tracking-caps text-fg-muted">
                    {participant?.jurisdictions.join(' ') ?? ''}
                  </span>
                </div>
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-secondary">
                  Also recorded as making{' '}
                  <Link
                    href={peer.shared.href}
                    className="text-fg-primary underline-offset-4 hover:underline"
                  >
                    {peer.shared.name}
                  </Link>
                  .
                </p>
                <p className="mt-1 text-xs text-fg-tertiary">That row is {peer.evidence}.</p>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 max-w-prose text-xs leading-relaxed text-fg-muted">
          This is who the corpus has found, not the market. &ldquo;The only producer&rdquo; and
          &ldquo;the only producer we have sourced&rdquo; are different claims, and this page can
          only make the second one.
        </p>
      </>
    );
  },
};

interface Mention {
  id: string;
  date: string;
  headline: string;
  source: string;
  /** The material the event is about, which is how it reaches this page. */
  through: Entity;
}

/**
 * News that reaches this organisation through what it makes.
 *
 * A company timeline only holds events that name the organisation, so a firm
 * central to a material could show "nothing recorded" while the material itself
 * had a shortage that month. Those events are relevant and were unreachable
 * from here — the reader had to already know to go and look.
 *
 * Labelled precisely: this is news about a material it makes, not about it.
 */
const relatedNews: ProfileModule<Mention[]> = {
  id: 'related-news',
  title: t('profile.relatedNews.title'),
  appliesTo: ['company'],
  importance: 82,
  load(entity: Entity) {
    const participant = participantBySlug(entity.key);
    if (!participant) return null;
    const own = new Set(participant.events.map((e) => e.id));
    const materials = participant.produces.map((row) => row.bottleneck);
    const found: Mention[] = [];
    for (const event of eventsNewestFirst()) {
      if (own.has(event.id)) continue;
      const hit = event.bottlenecks.find((name) => materials.includes(name));
      if (!hit) continue;
      const through = resolveIn('bottleneck', hit);
      if (!through) continue;
      found.push({
        id: event.id,
        date: event.date,
        headline: event.headline,
        source: event.source,
        through,
      });
    }
    return found.length > 0 ? found.slice(0, 8) : null;
  },
  evidence: (found) => `${found.length} about what it makes`,
  Render({ data }) {
    return (
      <>
        <ul className="divide-y divide-subtle border-y border-subtle">
          {data.map((mention) => (
            <li key={mention.id} className="py-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-xs tabular-nums text-fg-tertiary">
                  {mention.date}
                </span>
                <Link
                  href={mention.through.href}
                  className="font-mono text-xs uppercase tracking-caps text-fg-tertiary underline-offset-4 hover:text-fg-primary hover:underline"
                >
                  {mention.through.name}
                </Link>
              </div>
              <p className="mt-1 max-w-prose text-sm leading-relaxed text-fg-primary">
                {mention.headline}
              </p>
              <p className="mt-1 text-xs">
                <a
                  href={mention.source}
                  rel="noreferrer"
                  className="text-accent underline-offset-4 hover:underline"
                >
                  Source ↗
                </a>
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-3 max-w-prose text-xs leading-relaxed text-fg-muted">
          These name a material this organisation is recorded as making. They do not name the
          organisation, and are not evidence about it.
        </p>
      </>
    );
  },
};

export { peers, relatedNews };
