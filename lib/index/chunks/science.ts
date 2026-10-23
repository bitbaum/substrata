/**
 * Facet `science`: each relief technology with its readiness (a judgement on a
 * nine-step scale), what it would relieve and how, and what to watch next.
 */
import { readinessLabel, SCIENCE } from '@/config/substrata-science';
import { scienceHref } from '../../links';
import { entityId } from '../../entities/types';
import { chunkId, makeChunk, type Chunk } from '../chunk';
import { bottleneckIdByName, uniqueIds } from './ids';

export function scienceChunks(): Chunk[] {
  return SCIENCE.map((s) => {
    const relieves = s.relieves.map((r) => `relieves ${r.bottleneck}: ${r.mechanism}`).join('; ');
    const text = [
      `${s.name} (readiness ${s.readiness}/9, ${readinessLabel(s.readiness)}): ${s.plain}`,
      relieves ? ` ${relieves}.` : '',
      ` Why that readiness: ${s.readinessWhy}`,
      s.nextMilestone ? ` Next milestone: ${s.nextMilestone}` : '',
    ].join('');
    return makeChunk({
      id: chunkId('science', s.id),
      facet: 'science',
      kind: 'science',
      entityIds: uniqueIds(
        [entityId('science', s.id)],
        ...s.relieves.map((r) => bottleneckIdByName(r.bottleneck)),
      ),
      title: s.name,
      text,
      href: scienceHref(s.id),
      ...(s.source ? { sourceUrl: s.source } : {}),
      evidence: s.source ? 'sourced' : 'judgement',
      asOf: s.judgedOn,
      significance: s.readiness / 9,
    });
  });
}
