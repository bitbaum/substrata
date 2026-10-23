/**
 * Facet `event`: each accepted event (the committed file plus the rows accepted
 * at /review and merged into `EVENTS`) as one dated row.
 *
 * Accepted events are `sourced`: each carries its source and the sentence that
 * carries the claim. `candidate` is reserved for events not yet accepted, which
 * live in the database and reach the index with the store (PR 4).
 */
import { EVENTS } from '@/config/substrata-events';
import { bottleneckHref } from '../../links';
import { chunkId, makeChunk, recency, type Chunk } from '../chunk';
import { bottleneckIdByName, companyIdByName, countryId, countryName, uniqueIds } from './ids';

export function eventChunks(now = new Date()): Chunk[] {
  return EVENTS.map((e) => {
    const where = e.jurisdictions.map(countryName).join(', ');
    const text = [
      `${e.date} ${e.headline}`,
      `— ${e.effect} ${e.bottlenecks.join(', ')} (${e.kind}).`,
      e.participants.length ? `Participants: ${e.participants.join(', ')}.` : '',
      where ? `Jurisdictions: ${where}.` : '',
      e.quote ? `Source says: "${e.quote}"` : '',
    ]
      .filter(Boolean)
      .join(' ');
    const base = e.effect === 'neutral' ? 0.4 : 0.7;
    return makeChunk({
      id: chunkId('event', e.id),
      facet: 'event',
      entityIds: uniqueIds(
        ...e.bottlenecks.map(bottleneckIdByName),
        ...e.participants.map(companyIdByName),
        ...e.jurisdictions.map(countryId),
      ),
      title: e.headline,
      text,
      href: e.bottlenecks[0] ? bottleneckHref(e.bottlenecks[0]) : '/events',
      sourceUrl: e.source,
      evidence: 'sourced',
      asOf: e.date,
      significance: base * recency(e.date, now),
    });
  });
}
