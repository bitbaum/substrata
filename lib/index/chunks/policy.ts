/**
 * Facet `policy`: each instrument with its jurisdiction, body, status and date,
 * what it does, and who asked for it in their own words.
 */
import { INSTRUMENTS, JURISDICTION_LABEL } from '@/config/substrata-policy';
import { policyHref } from '../../links';
import { entityId } from '../../entities/types';
import { chunkId, makeChunk, type Chunk } from '../chunk';
import { bottleneckIdByName, companyIdByName, countryId, uniqueIds } from './ids';

export function policyChunks(): Chunk[] {
  return INSTRUMENTS.map((i) => {
    const asked = i.proponents.map((p) => `${p.name} asked: ${p.asked}`).join('; ');
    const text = [
      `${i.title} (${JURISDICTION_LABEL[i.jurisdiction]}, ${i.body}, ${i.status}, ${i.date}): ${i.summary}`,
      i.statusNote ? ` ${i.statusNote}` : '',
      i.bottlenecks.length ? ` Bears on: ${i.bottlenecks.join(', ')}.` : '',
      asked ? ` Proponents: ${asked}.` : '',
    ].join('');
    return makeChunk({
      id: chunkId('policy', i.id),
      facet: 'policy',
      kind: 'policy',
      entityIds: uniqueIds(
        [entityId('policy', i.id)],
        ...i.bottlenecks.map(bottleneckIdByName),
        ...i.proponents.map((p) => companyIdByName(p.name)),
        countryId(i.jurisdiction),
      ),
      title: i.title,
      text,
      href: policyHref(i.jurisdiction),
      sourceUrl: i.source,
      evidence: 'sourced',
      asOf: i.date,
      significance: i.status === 'in-force' ? 0.7 : 0.4,
    });
  });
}
